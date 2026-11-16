import type { Material } from './types';

const m = (x: Material): Material => x;

export const MATERIALS: Record<string, Material> = {
  // ── Timber ────────────────────────────────────────────────────────────
  koki: m({
    id: 'koki',
    kind: 'timber',
    name: { km: 'ឈើគគីរធម្មជាតិ', en: 'Natural Koki' },
    note: { km: 'ពណ៌ទឹកឃ្មុំស្រាល លាបម៉ាត់ថ្លា', en: 'Light honey tone, clear matte finish' },
    hex: '#BC9E76',
    roughness: 0.58,
    tier: 0,
  }),
  'koki-wash': m({
    id: 'koki-wash',
    kind: 'timber',
    name: { km: 'ឈើគគីរលាបស្រាល', en: 'Washed Koki' },
    note: { km: 'ស្រាល ស្រស់ លាបទឹកកំបោរស្រាលៗ', en: 'Pale and airy, softly limewashed' },
    hex: '#DCCDB0',
    roughness: 0.62,
    tier: 1,
  }),
  beng: m({
    id: 'beng',
    kind: 'timber',
    name: { km: 'ឈើធ្នង់លាបប្រេង', en: 'Oiled Khmer Beng' },
    note: { km: 'ពណ៌ត្នោតក្តៅ លាបប្រេងដោយដៃ', en: 'Warm padauk, hand-rubbed oil' },
    hex: '#7A4A2C',
    roughness: 0.48,
    tier: 1,
  }),
  ebonised: m({
    id: 'ebonised',
    kind: 'timber',
    name: { km: 'ឈើធ្នង់ជ្រលក់ខ្មៅ', en: 'Ebonised Beng' },
    note: { km: 'ជ្រលក់ខ្មៅដោយថ្នាំធម្មជាតិ មើលឃើញសរសៃឈើ', en: 'Blackened with natural dye, grain still visible' },
    hex: '#322A25',
    roughness: 0.5,
    tier: 2,
  }),
  neangnuon: m({
    id: 'neangnuon',
    kind: 'timber',
    name: { km: 'ឈើនាងនួនក្រម៉ៅ', en: 'Smoked Rosewood' },
    note: { km: 'ក្រហមខ្មៅ ក្រាស់ និងមានតម្លៃបំផុត', en: 'Deep, dense and the most prized Khmer timber' },
    hex: '#4A2B1F',
    roughness: 0.46,
    tier: 3,
  }),

  // ── Leather ───────────────────────────────────────────────────────────
  burgundy: m({
    id: 'burgundy',
    kind: 'leather',
    name: { km: 'ស្បែកក្រហមទុំ', en: 'Burgundy Hide' },
    note: { km: 'ស្បែកគោពេញសាច់ ជ្រលក់ដោយសំបកឈើ', en: 'Full-grain, vegetable-tanned' },
    hex: '#7A2630',
    roughness: 0.42,
    tier: 1,
  }),
  cognac: m({
    id: 'cognac',
    kind: 'leather',
    name: { km: 'ស្បែកពណ៌ស្ករត្នោត', en: 'Palm-Sugar Cognac' },
    note: { km: 'ស្បែកជ្រលក់សំបកឈើ ទន់ និងកាន់តែស្អាតតាមពេល', en: 'Bark-tanned, softens and deepens with age' },
    hex: '#9A5530',
    roughness: 0.45,
    tier: 2,
  }),
  basalt: m({
    id: 'basalt',
    kind: 'leather',
    name: { km: 'ស្បែកខ្មៅថ្មអង្គរ', en: 'Angkor Basalt Hide' },
    note: { km: 'ស្បែកលាបក្រមួនម៉ាត់', en: 'Matte waxed leather' },
    hex: '#2D2827',
    roughness: 0.5,
    tier: 1,
  }),

  // ── Bouclé ────────────────────────────────────────────────────────────
  chalk: m({
    id: 'chalk',
    kind: 'boucle',
    name: { km: 'ប៊ូក្លេពណ៌ដីស', en: 'Chalk Bouclé' },
    note: { km: 'ក្រណាត់ត្បាញរមួលទន់ៗ', en: 'Soft looped weave' },
    hex: '#EAE5DA',
    roughness: 0.92,
    tier: 1,
  }),
  oat: m({
    id: 'oat',
    kind: 'boucle',
    name: { km: 'ប៊ូក្លេពណ៌ស្រូវ', en: 'Oat Bouclé' },
    note: { km: 'ពណ៌ស្រូវទន់ ដែលងាយចុះសម្រុងនឹងបន្ទប់', en: 'A gentle neutral that suits most rooms' },
    hex: '#CFC1A7',
    roughness: 0.92,
    tier: 1,
  }),
  moss: m({
    id: 'moss',
    kind: 'boucle',
    name: { km: 'ប៊ូក្លេបៃតងស្លែ', en: 'Moss Bouclé' },
    note: { km: 'បៃតងស្រទន់ដូចព្រៃគិរីរម្យ', en: 'Soft green, like the Kirirom hills' },
    hex: '#6F7C63',
    roughness: 0.92,
    tier: 2,
  }),

  // ── Woven fabric & silk ───────────────────────────────────────────────
  linen: m({
    id: 'linen',
    kind: 'fabric',
    name: { km: 'ក្រណាត់ទេសឯកពណ៌ភ្លុក', en: 'Ivory Linen' },
    note: { km: 'ត្រជាក់ និងដកដង្ហើមបានល្អ មិនប្រើសារធាតុសម្អាត', en: 'Breathable and unbleached' },
    hex: '#E4DDCC',
    roughness: 0.88,
    tier: 0,
  }),
  sage: m({
    id: 'sage',
    kind: 'fabric',
    name: { km: 'ក្រណាត់ទេសឯកបៃតងស្រាល', en: 'Sage Linen' },
    note: { km: 'បៃតងស្រាលស្ងប់ស្ងាត់', en: 'Calm, muted green' },
    hex: '#9CA88E',
    roughness: 0.88,
    tier: 0,
  }),
  lotus: m({
    id: 'lotus',
    kind: 'fabric',
    name: { km: 'ក្រណាត់ពណ៌ផ្កាឈូក', en: 'Lotus Blush Linen' },
    note: { km: 'ពណ៌ផ្កាឈូកស្រាលៗ', en: 'A pale, warm pink' },
    hex: '#DCB1AA',
    roughness: 0.88,
    tier: 1,
  }),
  indigo: m({
    id: 'indigo',
    kind: 'fabric',
    name: { km: 'កប្បាសក្រមាពណ៌ខៀវចាស់', en: 'Indigo Krama Cotton' },
    note: { km: 'ជ្រលក់ពណ៌ធម្មជាតិ ត្បាញដូចក្រមាខ្មែរ', en: 'Plant-dyed, woven like a Khmer krama' },
    hex: '#34407A',
    roughness: 0.85,
    tier: 1,
  }),
  'takeo-silk': m({
    id: 'takeo-silk',
    kind: 'fabric',
    name: { km: 'សូត្រមាសតាកែវ', en: 'Takeo Golden Silk' },
    note: { km: 'សូត្រដិបត្បាញដោយដៃ', en: 'Hand-loomed raw silk' },
    hex: '#C9A05A',
    roughness: 0.6,
    tier: 3,
  }),
  'emerald-silk': m({
    id: 'emerald-silk',
    kind: 'fabric',
    name: { km: 'សូត្របៃតងប្រាសាទ', en: 'Prasat Emerald Silk' },
    note: { km: 'សូត្រជ្រលក់ពណ៌រុក្ខជាតិ', en: 'Botanically dyed silk' },
    hex: '#2F4F42',
    roughness: 0.6,
    tier: 3,
  }),

  // ── Cane ──────────────────────────────────────────────────────────────
  'cane-natural': m({
    id: 'cane-natural',
    kind: 'cane',
    name: { km: 'ផ្តៅខ្មែរធម្មជាតិ', en: 'Natural Khmer Cane' },
    note: { km: 'ផ្តៅត្បាញដោយដៃ មិនជ្រលក់ពណ៌', en: 'Hand-woven, undyed' },
    hex: '#D6BF96',
    roughness: 0.8,
    tier: 0,
  }),
  'cane-smoked': m({
    id: 'cane-smoked',
    kind: 'cane',
    name: { km: 'ផ្តៅជក់ផ្សែង', en: 'Smoked Rattan' },
    note: { km: 'ពណ៌ត្នោតស្រទន់ ពីការជក់ផ្សែង', en: 'Earthy brown from natural smoking' },
    hex: '#82664C',
    roughness: 0.8,
    tier: 1,
  }),
  'cane-charcoal': m({
    id: 'cane-charcoal',
    kind: 'cane',
    name: { km: 'ផ្តៅខ្មៅធ្យូង', en: 'Charcoal Rattan' },
    note: { km: 'ផ្តៅខ្មៅម៉ាត់', en: 'Matte, near-black weave' },
    hex: '#3A3530',
    roughness: 0.76,
    tier: 2,
  }),

  // ── Metal ─────────────────────────────────────────────────────────────
  brass: m({
    id: 'brass',
    kind: 'metal',
    name: { km: 'លង្ហិនម៉ាត់', en: 'Satin Brass' },
    note: { km: 'កាន់តែស្អាតតាមការប្រើប្រាស់', en: 'Warms with age and touch' },
    hex: '#C09A5E',
    roughness: 0.34,
    tier: 1,
  }),
  nickel: m({
    id: 'nickel',
    kind: 'metal',
    name: { km: 'នីកែលដុសម៉ាត់', en: 'Brushed Nickel' },
    note: { km: 'ពណ៌ប្រាក់ត្រជាក់', en: 'Cool, quiet silver' },
    hex: '#C5C7CA',
    roughness: 0.38,
    tier: 1,
  }),
  'black-steel': m({
    id: 'black-steel',
    kind: 'metal',
    name: { km: 'ដែកខ្មៅ', en: 'Blackened Steel' },
    note: { km: 'ដែកលាបខ្មៅម៉ាត់', en: 'Matte black powder coat' },
    hex: '#2B2B2E',
    roughness: 0.5,
    tier: 0,
  }),

  // ── Stone ─────────────────────────────────────────────────────────────
  limestone: m({
    id: 'limestone',
    kind: 'stone',
    name: { km: 'ថ្មកំបោរខាត់ម៉ាត់', en: 'Honed Limestone' },
    note: { km: 'ពណ៌ខ្សាច់ស្រាល ត្រជាក់នៅពេលប៉ះ', en: 'Pale sand tone, cool to the touch' },
    hex: '#D9D3C7',
    roughness: 0.55,
    tier: 2,
  }),
  travertine: m({
    id: 'travertine',
    kind: 'stone',
    name: { km: 'ថ្មត្រាវើទីន', en: 'Warm Travertine' },
    note: { km: 'ថ្មធម្មជាតិមានក្រហែង', en: 'Natural stone with soft pitting' },
    hex: '#CDB99B',
    roughness: 0.6,
    tier: 2,
  }),
  nero: m({
    id: 'nero',
    kind: 'stone',
    name: { km: 'ថ្មម៉ាប៊លខ្មៅ', en: 'Nero Marble' },
    note: { km: 'ខ្មៅជ្រៅ មានសរសៃស', en: 'Deep black with fine white veins' },
    hex: '#2C2C2F',
    roughness: 0.28,
    tier: 3,
  }),

  // ── Lacquer ───────────────────────────────────────────────────────────
  'lacquer-ivory': m({
    id: 'lacquer-ivory',
    kind: 'paint',
    name: { km: 'ថ្នាំលាបពណ៌ភ្លុក', en: 'Ivory Lacquer' },
    note: { km: 'លាបម៉ាត់ ជូតសម្អាតបានស្រួល', en: 'Matte and easy to wipe clean' },
    hex: '#E8E2D4',
    roughness: 0.5,
    tier: 1,
  }),
  'lacquer-sage': m({
    id: 'lacquer-sage',
    kind: 'paint',
    name: { km: 'ថ្នាំលាបបៃតងស្រាល', en: 'Sage Lacquer' },
    note: { km: 'បៃតងស្រទន់ ស្ងប់ស្ងាត់', en: 'Soft, quiet green' },
    hex: '#7F8D75',
    roughness: 0.5,
    tier: 1,
  }),
  'lacquer-indigo': m({
    id: 'lacquer-indigo',
    kind: 'paint',
    name: { km: 'ថ្នាំលាបខៀវចាស់', en: 'Indigo Lacquer' },
    note: { km: 'ខៀវចាស់ជ្រៅ', en: 'Deep, inky blue' },
    hex: '#2C3668',
    roughness: 0.45,
    tier: 2,
  }),
  'lacquer-red': m({
    id: 'lacquer-red',
    kind: 'paint',
    name: { km: 'ថ្នាំលាបក្រហមខ្មែរ', en: 'Khmer Lacquer Red' },
    note: { km: 'ក្រហមបុរាណ ដូចរបងវត្ត', en: 'Temple-door red, richly saturated' },
    hex: '#8F2D24',
    roughness: 0.42,
    tier: 2,
  }),
};

export function getMaterial(id: string): Material {
  const found = MATERIALS[id];
  if (!found) throw new Error(`Unknown material "${id}"`);
  return found;
}

/** Surcharge for each material tier as a share of the slot's sized price. */
export const TIER_PREMIUM: Record<Material['tier'], number> = {
  0: 0,
  1: 0.035,
  2: 0.07,
  3: 0.11,
};

/** Reusable material groups for slot definitions. */
export const GROUPS = {
  timbers: ['koki', 'koki-wash', 'beng', 'ebonised', 'neangnuon'],
  timbersShort: ['koki', 'beng', 'ebonised', 'neangnuon'],
  leathers: ['burgundy', 'cognac', 'basalt'],
  boucles: ['chalk', 'oat', 'moss'],
  fabrics: ['linen', 'sage', 'lotus', 'indigo', 'takeo-silk', 'emerald-silk'],
  silks: ['takeo-silk', 'emerald-silk', 'indigo', 'linen'],
  canes: ['cane-natural', 'cane-smoked', 'cane-charcoal'],
  metals: ['brass', 'nickel', 'black-steel'],
  stones: ['limestone', 'travertine', 'nero'],
  lacquers: ['lacquer-ivory', 'lacquer-sage', 'lacquer-indigo', 'lacquer-red'],
} as const;
