import * as THREE from 'three';

function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function fbm2D(x: number, y: number, seed: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    const xi = Math.floor(x * freq);
    const yi = Math.floor(y * freq);
    const xf = x * freq - xi;
    const yf = y * freq - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = pseudoNoise(xi, yi, seed + i * 13);
    const b = pseudoNoise(xi + 1, yi, seed + i * 13);
    const c = pseudoNoise(xi, yi + 1, seed + i * 13);
    const d = pseudoNoise(xi + 1, yi + 1, seed + i * 13);
    const nx0 = a + (b - a) * u;
    const nx1 = c + (d - c) * u;
    value += (nx0 + (nx1 - nx0) * v) * amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

export interface PBRTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export function createWalnutTextures(
  variant: 'table' | 'oiled' | 'smoked' | 'tintable',
  maxAnisotropy: number,
): PBRTextureSet {
  const size = variant === 'table' ? 1024 : 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  const palettes = {
    table: { dark: [22, 13, 8], mid: [44, 27, 17], light: [70, 44, 27], roughBase: 112 },
    oiled: { dark: [46, 26, 15], mid: [82, 48, 28], light: [118, 72, 43], roughBase: 102 },
    smoked: { dark: [28, 18, 13], mid: [52, 34, 24], light: [78, 52, 37], roughBase: 112 },
    // High-key neutral wood grain map designed for real-time material.color tinting
    tintable: { dark: [148, 142, 136], mid: [216, 212, 206], light: [252, 250, 246], roughBase: 105 },
  };
  const pal = palettes[variant];
  const seed = variant === 'table' ? 11 : variant === 'oiled' ? 29 : variant === 'smoked' ? 47 : 61;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      const warp = fbm2D(u * 4.5, v * 1.8, seed) * 2.4;
      const ringCoord = u * 16 + warp + Math.sin(v * Math.PI * 2) * 0.4;
      const ring = 0.5 + 0.5 * Math.sin(ringCoord * Math.PI);
      const sharpRing = Math.pow(ring, 1.45);
      const microFiber = fbm2D(u * 64, v * 10, seed + 5);
      const pore = pseudoNoise(x * 0.8, y * 0.25, seed + 9) > 0.89 ? -0.18 : 0;

      const t = Math.max(0, Math.min(1, sharpRing * 0.65 + microFiber * 0.35 + pore));
      let r: number;
      let g: number;
      let b: number;
      if (t < 0.5) {
        const k = t * 2;
        r = pal.dark[0] + (pal.mid[0] - pal.dark[0]) * k;
        g = pal.dark[1] + (pal.mid[1] - pal.dark[1]) * k;
        b = pal.dark[2] + (pal.mid[2] - pal.dark[2]) * k;
      } else {
        const k = (t - 0.5) * 2;
        r = pal.mid[0] + (pal.light[0] - pal.mid[0]) * k;
        g = pal.mid[1] + (pal.light[1] - pal.mid[1]) * k;
        b = pal.mid[2] + (pal.light[2] - pal.mid[2]) * k;
      }

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.round(r);
      cImg.data[idx + 1] = Math.round(g);
      cImg.data[idx + 2] = Math.round(b);
      cImg.data[idx + 3] = 255;

      const bumpVal = Math.max(0, Math.min(255, Math.round(128 + (sharpRing - 0.5) * 65 + pore * 180)));
      bImg.data[idx] = bumpVal;
      bImg.data[idx + 1] = bumpVal;
      bImg.data[idx + 2] = bumpVal;
      bImg.data[idx + 3] = 255;

      const roughVal = Math.max(40, Math.min(230, Math.round(pal.roughBase + (1 - t) * 48 - pore * 75)));
      rImg.data[idx] = roughVal;
      rImg.data[idx + 1] = roughVal;
      rImg.data[idx + 2] = roughVal;
      rImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.MirroredRepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.MirroredRepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

export function createLeatherTextures(maxAnisotropy: number): PBRTextureSet {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // High-key neutral pull-up mottling & fine pebble grain for material.color tinting
      const mottle = fbm2D(u * 5, v * 5, 73);
      const pebble = fbm2D(u * 76, v * 76, 91);
      const crease = Math.sin((u * 3 + mottle * 0.6) * Math.PI * 2) * 0.04;
      const shade = Math.min(1.0, Math.max(0.72, 0.80 + mottle * 0.22 + pebble * 0.08 + crease));

      const gray = Math.min(255, Math.round(248 * shade));
      const idx = (y * size + x) * 4;
      cImg.data[idx] = gray;
      cImg.data[idx + 1] = Math.round(gray * 0.99);
      cImg.data[idx + 2] = Math.round(gray * 0.98);
      cImg.data[idx + 3] = 255;

      const bv = Math.max(0, Math.min(255, Math.round(85 + pebble * 155)));
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;

      const rv = Math.max(60, Math.min(185, Math.round(96 + (1 - mottle) * 46 - pebble * 18)));
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.MirroredRepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.MirroredRepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

export function createBoucleTextures(maxAnisotropy: number): PBRTextureSet {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // High-key looped bouclé yarn nubs (tints cleanly via material.color)
      const loopA = fbm2D(u * 48, v * 48, 103);
      const loopB = fbm2D(u * 96, v * 96, 127);
      const weave = 0.5 + 0.5 * Math.sin(u * 160) * Math.cos(v * 160);
      const nub = Math.pow(loopA * 0.65 + loopB * 0.35, 1.15);

      const base = 232 + Math.round((nub - 0.44) * 36 + (weave - 0.5) * 10);
      const idx = (y * size + x) * 4;
      const val = Math.min(255, Math.max(202, base));
      cImg.data[idx] = val;
      cImg.data[idx + 1] = val;
      cImg.data[idx + 2] = Math.max(196, val - 2);
      cImg.data[idx + 3] = 255;

      const bv = Math.max(0, Math.min(255, Math.round(nub * 240 + weave * 15)));
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;

      const rv = Math.max(190, Math.min(250, Math.round(226 - nub * 28)));
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
  map.repeat.set(3, 3);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.MirroredRepeatWrapping;
  bumpMap.repeat.set(3, 3);
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.MirroredRepeatWrapping;
  roughnessMap.repeat.set(3, 3);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

export function createFabricWeaveTexture(
  baseRgb: [number, number, number],
  weaveContrast: number,
  repeat: number,
  maxAnisotropy: number,
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = Math.sin((x / size) * Math.PI * 64);
      const weft = Math.sin((y / size) * Math.PI * 64);
      const thread = ((x + y) % 4 < 2 ? warp : weft) * 0.5 + 0.5;
      const slub = fbm2D((x / size) * 24, (y / size) * 24, 151);
      const delta = (thread - 0.5) * weaveContrast + (slub - 0.5) * 10;

      const idx = (y * size + x) * 4;
      cImg.data[idx] = Math.max(0, Math.min(255, Math.round(baseRgb[0] + delta)));
      cImg.data[idx + 1] = Math.max(0, Math.min(255, Math.round(baseRgb[1] + delta)));
      cImg.data[idx + 2] = Math.max(0, Math.min(255, Math.round(baseRgb[2] + delta)));
      cImg.data[idx + 3] = 255;

      const bv = Math.max(0, Math.min(255, Math.round(128 + (thread - 0.5) * 90 + (slub - 0.5) * 40)));
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeat, repeat);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

export function createPaperEdgeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#E6DEC9';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 2) {
    const shade = 216 + Math.round(Math.sin(y * 0.9) * 10 + (pseudoNoise(y, 1, 7) - 0.5) * 18);
    ctx.fillStyle = `rgb(${shade}, ${shade - 7}, ${shade - 20})`;
    ctx.fillRect(0, y, w, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(18, 12, 8, 0.78)');
  grad.addColorStop(0.48, 'rgba(22, 15, 10, 0.42)');
  grad.addColorStop(0.8, 'rgba(24, 16, 11, 0.12)');
  grad.addColorStop(1, 'rgba(24, 16, 11, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRattanCaneTextures(maxAnisotropy: number): PBRTextureSet {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colorCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colorCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colorCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;

  const cImg = cCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x % 32) / 32;
      const gy = (y % 32) / 32;
      const diagA = Math.abs(((x + y) % 32) / 32 - 0.5);
      const diagB = Math.abs(((x - y + 256) % 32) / 32 - 0.5);
      const horiz = Math.abs(gy - 0.5);
      const vert = Math.abs(gx - 0.5);

      const strandH = Math.max(0, 1 - horiz * 5.2);
      const strandV = Math.max(0, 1 - vert * 5.2);
      const strandD = Math.max(0, 1 - Math.min(diagA, diagB) * 6.0) * 0.72;
      const weave = Math.min(1, Math.max(strandH, strandV, strandD));

      // High-key neutral cane fibers vs recessed shadow pores
      const val = Math.round(98 + weave * 150);
      const idx = (y * size + x) * 4;
      cImg.data[idx] = val;
      cImg.data[idx + 1] = Math.round(val * 0.98);
      cImg.data[idx + 2] = Math.round(val * 0.94);
      cImg.data[idx + 3] = 255;

      const bv = Math.round(35 + weave * 215);
      bImg.data[idx] = bv;
      bImg.data[idx + 1] = bv;
      bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;

      const rv = Math.round(235 - weave * 60);
      rImg.data[idx] = rv;
      rImg.data[idx + 1] = rv;
      rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 4);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 4);
  bumpMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 4);
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, bumpMap, roughnessMap };
}

