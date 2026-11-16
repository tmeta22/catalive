import * as THREE from 'three';
import type { Config, Product } from '../data/types';
import { Studio } from './studio';

/**
 * WebXR augmented reality: place a piece of furniture on the real floor and
 * walk around it. The device does the tracking, the browser does the hit test,
 * and we draw the same procedural model the configurator uses.
 */

export type ArState = 'idle' | 'starting' | 'scanning' | 'placed' | 'ended';

export interface ArSessionOptions {
  /** Element used as the in-AR DOM overlay (the buttons over the camera). */
  overlay: HTMLElement;
  onState?: (state: ArState) => void;
  onError?: (message: string) => void;
}

/** True when this browser can run an immersive AR session. */
export async function arSupported(): Promise<boolean> {
  const xr = navigator.xr;
  if (!xr || typeof xr.isSessionSupported !== 'function') return false;
  try {
    return await xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

function reticleMesh(): THREE.Mesh {
  const ring = new THREE.RingGeometry(0.09, 0.13, 48).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2e3c86,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(ring, mat);
  mesh.renderOrder = 30;
  mesh.visible = false;
  return mesh;
}

export class ArSession {
  readonly studio: Studio;

  private session: XRSession | null = null;
  private hitTestSource: XRHitTestSource | null = null;
  private anchor: XRAnchor | null = null;
  private readonly reticle = reticleMesh();
  private readonly hitMatrix = new THREE.Matrix4();
  private readonly rotationMatrix = new THREE.Matrix4();
  private readonly tmp = new THREE.Matrix4();
  private readonly target = new THREE.Vector3();
  private readonly lightAt = new THREE.Vector3();

  private rotation = 0;
  private placed = false;
  private stopped = false;
  private lastHit: XRHitTestResult | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.studio = new Studio(canvas, { alpha: true, shadowMapSize: 1024 });
    this.studio.setContactShadow(false);
    this.studio.scene.add(this.reticle);
  }

  get state(): ArState {
    if (!this.session) return 'idle';
    return this.placed ? 'placed' : 'scanning';
  }

  /** Request the camera and start tracking the floor. */
  async start(opts: ArSessionOptions): Promise<void> {
    if (!navigator.xr) throw new Error('This browser has no WebXR support.');
    opts.onState?.('starting');

    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor', 'anchors', 'dom-overlay'],
      domOverlay: { root: opts.overlay },
    });
    this.session = session;
    this.stopped = false;

    // 'local-floor' puts the origin on the real floor; fall back to the
    // device's own frame if the runtime doesn't offer it.
    const features = (session.enabledFeatures ?? []) as readonly string[];
    const spaceType = features.includes('local-floor') ? 'local-floor' : 'local';

    const renderer = this.studio.renderer;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType(spaceType);
    await renderer.xr.setSession(session);

    const viewerSpace = await session.requestReferenceSpace('viewer');
    try {
      this.hitTestSource = (await session.requestHitTestSource?.({ space: viewerSpace })) ?? null;
    } catch {
      this.hitTestSource = null;
    }

    session.addEventListener('end', this.onSessionEnd);
    session.addEventListener('select', this.onSelect);

    renderer.setAnimationLoop(this.onFrame);
    opts.onState?.('scanning');
  }

  /** Rebuild the piece (a new size or material) and keep it where it stands. */
  setProduct(p: Product, cfg: Config): void {
    const wasPlaced = this.placed;
    const pos = this.studio.piece?.position.clone() ?? new THREE.Vector3();
    this.studio.setProduct(p, cfg);
    if (wasPlaced) {
      this.studio.placePiece(pos, this.rotation);
      this.studio.moveShadowCatcher(pos);
    }
  }

  /** Turn the placed piece by `radians`. */
  rotate(radians: number): void {
    this.rotation += radians;
    const piece = this.studio.piece;
    if (!piece || !this.placed) return;
    if (this.anchor) {
      this.applyAnchorPose();
    } else {
      piece.rotation.y = this.rotation;
      piece.updateMatrixWorld(true);
    }
  }

  /** Move the piece back to the reticle and forget the anchor. */
  reset(): void {
    this.placed = false;
    this.anchor = null;
    const piece = this.studio.piece;
    if (piece) {
      piece.position.set(0, 0, 0);
      piece.rotation.set(0, 0, 0);
      piece.updateMatrixWorld(true);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.studio.renderer.setAnimationLoop(null);
    const session = this.session;
    this.session = null;
    this.hitTestSource = null;
    this.anchor = null;
    if (session) {
      session.removeEventListener('end', this.onSessionEnd);
      session.removeEventListener('select', this.onSelect);
      try {
        await session.end();
      } catch {
        /* already finished */
      }
    }
    this.studio.renderer.xr.enabled = false;
    this.reticle.visible = false;
  }

  dispose(): void {
    void this.stop();
    this.studio.dispose();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private onSessionEnd = (): void => {
    if (this.stopped) return;
    this.stopped = true;
    this.studio.renderer.setAnimationLoop(null);
    this.studio.renderer.xr.enabled = false;
    this.reticle.visible = false;
    this.session = null;
    this.hitTestSource = null;
    this.anchor = null;
    this.placed = false;
    this.onEnd?.();
  };

  /** Set by the caller so the UI can react to the session ending. */
  onEnd?: () => void;

  private onSelect = (): void => {
    if (!this.reticle.visible) return;
    this.placeHere();
  };

  private placeHere(): void {
    const piece = this.studio.piece;
    if (!piece) return;
    this.placed = true;
    const pos = new THREE.Vector3().setFromMatrixPosition(this.hitMatrix);
    piece.position.copy(pos);
    piece.rotation.y = this.rotation;
    piece.updateMatrixWorld(true);
    this.studio.moveShadowCatcher(pos);
    this.reticle.visible = false;
    void this.anchorToLastHit();
  }

  /** Ask the runtime to keep the piece pinned to the real world, if it can. */
  private async anchorToLastHit(): Promise<void> {
    const result = this.lastHit;
    if (!result?.createAnchor) return;
    try {
      this.anchor = (await result.createAnchor()) ?? null;
    } catch {
      this.anchor = null;
    }
  }

  private applyAnchorPose(): void {
    const piece = this.studio.piece;
    const anchor = this.anchor;
    if (!piece || !anchor) return;
    const frame = this.studio.renderer.xr.getFrame();
    const refSpace = this.studio.renderer.xr.getReferenceSpace();
    if (!frame || !refSpace) return;
    const pose = frame.getPose(anchor.anchorSpace, refSpace);
    if (!pose) return;
    this.tmp.fromArray(pose.transform.matrix);
    this.rotationMatrix.makeRotationY(this.rotation);
    this.tmp.multiply(this.rotationMatrix);
    piece.matrix.copy(this.tmp);
    piece.matrix.decompose(piece.position, piece.quaternion, piece.scale);
    piece.updateMatrixWorld(true);
    this.studio.moveShadowCatcher(piece.position);
  }

  private onFrame = (): void => {
    const renderer = this.studio.renderer;
    const frame = renderer.xr.getFrame();
    const refSpace = renderer.xr.getReferenceSpace();

    if (frame && refSpace && this.hitTestSource) {
      const results = frame.getHitTestResults(this.hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(refSpace);
        if (pose) {
          this.lastHit = results[0];
          this.hitMatrix.fromArray(pose.transform.matrix);
          this.reticle.matrix.copy(this.hitMatrix);
          this.reticle.matrixAutoUpdate = false;
          this.reticle.visible = !this.placed;
          this.reticle.updateMatrixWorld(true);
        }
      } else if (!this.placed) {
        this.reticle.visible = false;
      }
    }

    if (this.placed && this.anchor) this.applyAnchorPose();

    // Light the piece from roughly where the viewer is standing.
    const cam = renderer.xr.getCamera();
    if (cam) {
      this.lightAt.setFromMatrixPosition(cam.matrixWorld);
      this.target.copy(this.studio.piece?.position ?? new THREE.Vector3());
      this.target.y += this.studio.size.y * 0.4;
      this.studio.aimLight(this.lightAt, this.target);
    }

    this.studio.render();
  };
}
