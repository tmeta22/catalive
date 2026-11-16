/**
 * Sizing rules shared by the product data (insights, pricing) and the 3D
 * builders, so what the customer reads and what they see always agree.
 * All lengths are millimetres unless a name says otherwise.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Sofa arm thickness for each arm style. */
export function sofaArmMm(arms: string): number {
  return arms === 'wide' ? 230 : 150;
}

/** A sofa gains a seat for every ~70 cm of usable width. */
export function sofaSeats(widthMm: number, arms: string): number {
  const usable = widthMm - sofaArmMm(arms) * 2;
  return clamp(Math.round(usable / 700), 1, 6);
}

export function loungeSeatHeightMm(heightMm: number): number {
  return clamp(Math.round(heightMm * 0.55), 340, 480);
}

export function sofaSeatHeightMm(heightMm: number): number {
  return clamp(Math.round(heightMm * 0.54), 340, 460);
}

export function benchSeats(widthMm: number): number {
  return Math.max(1, Math.round(widthMm / 480));
}

/** How many people sit comfortably (min) and snugly (max) at a table. */
export function tableSeats(shape: string, widthMm: number, depthMm: number): [number, number] {
  if (shape === 'round') {
    const n = Math.floor((Math.PI * widthMm) / 620);
    return [Math.max(2, n), Math.max(2, n)];
  }
  const sides = 2 * Math.floor((widthMm - 250) / 620);
  const ends = depthMm >= 800 ? 2 : 0;
  const comfy = Math.max(2, sides + ends);
  return [comfy, comfy + (widthMm > 1500 ? 2 : 0)];
}

export const MATTRESS_SIZES: { name: string; en: string; km: string; w: number; l: number }[] = [
  { name: 'single', en: 'Single', km: 'ដេកម្នាក់', w: 1000, l: 2000 },
  { name: 'double', en: 'Double', km: 'ដេកពីរនាក់តូច', w: 1350, l: 2000 },
  { name: 'queen', en: 'Queen', km: 'ពូកធំ (Queen)', w: 1500, l: 2000 },
  { name: 'king', en: 'King', km: 'ពូកធំពិសេស (King)', w: 1800, l: 2000 },
  { name: 'superking', en: 'Super King', km: 'ពូកធំបំផុត', w: 2000, l: 2000 },
];

/** Bed frame is the mattress plus 60 mm each side; headboard adds 160 mm. */
export const BED_SIDE_MM = 60;
export const BED_HEADBOARD_MM = 160;

export function bedMattress(widthMm: number, depthMm: number) {
  const w = widthMm - BED_SIDE_MM * 2;
  const l = depthMm - BED_HEADBOARD_MM;
  const match = MATTRESS_SIZES.find((m) => Math.abs(m.w - w) <= 40 && Math.abs(m.l - l) <= 60);
  return { w, l, match };
}

/** Doors or drawer bays across a cabinet front. */
export function cabinetBays(widthMm: number, target = 500): number {
  return clamp(Math.round(widthMm / target), 1, 8);
}

export function shelfRows(heightMm: number): number {
  return clamp(Math.round(heightMm / 340), 2, 9);
}

export function dividerCount(widthMm: number): number {
  return clamp(Math.ceil(widthMm / 820) - 1, 0, 3);
}

export function tableTopMm(thickness: string): number {
  return thickness === 'slim' ? 30 : thickness === 'bold' ? 70 : 45;
}
