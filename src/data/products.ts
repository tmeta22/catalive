import { GROUPS } from './materials';
import {
  benchSeats,
  bedMattress,
  loungeSeatHeightMm,
  sofaSeatHeightMm,
  sofaSeats,
  tableSeats,
} from './rules';
import type {
  CategoryId,
  ChoiceItem,
  Config,
  DimSpec,
  Insight,
  LocalizedText,
  OptionSpec,
  OptionValue,
  Preset,
  Product,
  SlotRole,
  SlotSpec,
} from './types';

// ── Small authoring helpers ────────────────────────────────────────────────

const L = (km: string, en: string): LocalizedText => ({ km, en });
const dim = (min: number, def: number, max: number, step = 10): DimSpec => ({ min, def, max, step });
const ins = (id: string, km: string, en: string): Insight => ({ id, text: L(km, en) });
const cm = (mm: number) => Math.round(mm / 10);

const slot = (
  id: SlotRole,
  label: LocalizedText,
  materials: readonly string[],
  def: string,
  weight: number,
  help?: LocalizedText,
  when?: SlotSpec['when'],
): SlotSpec => ({ id, label, materials: [...materials], default: def, weight, help, when });

const ch = (id: string, km: string, en: string, extra: Partial<ChoiceItem> = {}): ChoiceItem => ({
  id,
  label: L(km, en),
  ...extra,
});

const choice = (
  id: string,
  label: LocalizedText,
  choices: ChoiceItem[],
  def: string,
  extra: { help?: LocalizedText; when?: (o: Record<string, OptionValue>) => boolean } = {},
): OptionSpec => ({ id, type: 'choice', label, choices, default: def, ...extra });

const toggle = (
  id: string,
  label: LocalizedText,
  def: boolean,
  extra: { help?: LocalizedText; flat?: number; pct?: number; when?: (o: Record<string, OptionValue>) => boolean } = {},
): OptionSpec => ({ id, type: 'toggle', label, default: def, ...extra });

const count = (
  id: string,
  label: LocalizedText,
  min: number,
  def: number,
  max: number,
  extra: { flatPer?: number; help?: LocalizedText; when?: (o: Record<string, OptionValue>) => boolean } = {},
): OptionSpec => ({ id, type: 'count', label, min, max, default: def, ...extra });

const preset = (
  id: string,
  km: string,
  en: string,
  w: number,
  d: number,
  h: number,
  opts?: Record<string, OptionValue>,
): Preset => ({ id, label: L(km, en), w, d, h, opts });

// ── Shared labels & copy ───────────────────────────────────────────────────

const LBL = {
  frame: L('ឈើគ្រោង', 'Frame timber'),
  legs: L('ឈើជើង', 'Leg timber'),
  hardware: L('ពណ៌គ្រឿងលោហៈ', 'Hardware finish'),
  upholstery: L('ស្បែក ឬក្រណាត់ស្រោប', 'Upholstery'),
  top: L('ផ្ទៃតុ', 'Tabletop'),
  front: L('ទ្វារ និងមុខថត', 'Doors & drawer fronts'),
  legsOpt: L('ទម្រង់ជើង', 'Leg style'),
  base: L('ជើង ឬគល់', 'Base'),
  handles: L('ដៃចាប់', 'Handles'),
  shape: L('រូបរាងផ្ទៃតុ', 'Top shape'),
  feel: L('អារម្មណ៍នៅពេលអង្គុយ', 'Seat feel'),
  frontStyle: L('រចនាមុខទ្វារ', 'Front style'),
};

const FEEL = (def = 'medium') =>
  choice(
    'feel',
    LBL.feel,
    [ch('soft', 'ទន់', 'Soft'), ch('medium', 'មធ្យម', 'Medium'), ch('firm', 'រឹង', 'Firm')],
    def,
    { help: L('កំណត់ដង់ស៊ីតេស្នោ។ មិនប៉ះពាល់តម្លៃទេ។', 'Sets the foam density. No effect on price.') },
  );

const HANDLES = choice(
  'handles',
  LBL.handles,
  [
    ch('pull', 'ដៃចាប់វែង', 'Long pulls'),
    ch('knob', 'ប៊ូតុងមូល', 'Round knobs'),
    ch('none', 'គ្មាន (ចុចបើក)', 'None (push to open)', { flat: 60 }),
  ],
  'pull',
);

const FRONT_STYLE = choice(
  'front',
  LBL.frontStyle,
  [
    ch('framed', 'ស៊ុមមានផ្ទាំងខាងក្នុង', 'Framed panel'),
    ch('panel', 'ផ្ទាំងរាបស្មើ', 'Flat panel'),
    ch('slatted', 'បន្ទះបញ្ឈរ', 'Vertical slats', { pct: 0.03 }),
  ],
  'framed',
);

const CONSTRUCTION = {
  timber: L(
    'ឈើខ្មែរសម្ងួតក្នុងឡ ភ្ជាប់ដោយតំណមុខតុ និងម្ជុលឈើ គ្មានដែកគោល។',
    'Kiln-dried Khmer hardwood joined with pinned mortise-and-tenon joints. No nails.',
  ),
  upholstered: L(
    'គ្រោងឈើរឹង ស្នោខ្លាំងរុំដោយសំឡីគ្រៃ និងរោមសត្វ ស្រោបដេរដោយដៃ។',
    'Hardwood frame, high-resilience foam wrapped in kapok and down, hand-stitched covers.',
  ),
  cabinet: L(
    'តួទូឈើរឹង ថតភ្ជាប់ដោយតំណកន្ទុយព្រាប និងកាត់បិទស្រាលៗ។',
    'Solid hardwood carcass, dovetailed drawers and soft-close hinges.',
  ),
  table: L(
    'ផ្ទៃតុធ្វើពីក្តារផ្គូផ្គងគ្នា ភ្ជាប់ដោយសោមេអំបៅ ហើយជើងភ្ជាប់ដោយតំណមុខតុ។',
    'Top built from matched boards joined with butterfly keys; legs pinned with mortise-and-tenon joints.',
  ),
  bed: L(
    'គ្រោងឈើរឹងមានរនាបទ្រពូក ក្បាលគ្រែស្រោបដោយដៃ។ ផ្គុំដោយតំណឈើ មិនប្រើដែកគោល។',
    'Hardwood frame with a slatted mattress base and a hand-upholstered headboard. Assembled with timber joints, not nails.',
  ),
};

const CARE = {
  timber: L('ជូតធូលីរៀងរាល់សប្តាហ៍ ហើយលាបប្រេងរៀងរាល់ ៦ ខែ។', 'Dust weekly and re-oil every six months.'),
  upholstered: L(
    'បូមធូលីថ្នមៗ។ ស្បែកគួរលាបប្រេងបំប៉ន ២ ដងក្នុងមួយឆ្នាំ។ ក្រណាត់ត្រូវសម្អាតដោយអ្នកជំនាញ។',
    'Vacuum gently. Condition leather twice a year; have fabric professionally cleaned.',
  ),
  stone: L(
    'ជូតភ្លាមៗពេលកំពប់ ហើយកុំប្រើសារធាតុអាស៊ីត។ ឈើគួរលាបប្រេងរៀងរាល់ ៦ ខែ។',
    'Wipe spills at once and avoid acidic cleaners. Re-oil any timber twice a year.',
  ),
  lacquer: L('ជូតដោយក្រណាត់សើមស្រាល។ មិនត្រូវការលាបប្រេងទេ។', 'Wipe with a damp cloth. No oiling needed.'),
};

const WARRANTY = {
  y15: L('ធានារចនាសម្ព័ន្ធ ១៥ ឆ្នាំ', '15-year structural guarantee'),
  y20: L('ធានារចនាសម្ព័ន្ធ ២០ ឆ្នាំ', '20-year structural guarantee'),
  y25: L('ធានាសាច់ឈើមិនប្រេះ ២៥ ឆ្នាំ', '25-year solid-timber guarantee'),
};

const ORIGIN = {
  pp: L('ផលិតនៅភ្នំពេញ', 'Made in Phnom Penh'),
  sr: L('ផលិតនៅសៀមរាប', 'Made in Siem Reap'),
  kc: L('ផលិតនៅកំពង់ចាម', 'Made in Kampong Cham'),
  tk: L('ផលិតនៅតាកែវ', 'Made in Takeo'),
};

const SIZE = {
  seating: { w: 0.7, d: 0.5, h: 0.3 },
  tables: { w: 0.85, d: 0.6, h: 0.2 },
  storage: { w: 0.9, d: 0.5, h: 0.4 },
  bed: { w: 0.6, d: 0.6, h: 0.3 },
};

const hardwareSlot = (def = 'brass', help?: LocalizedText, when?: SlotSpec['when']) =>
  slot('accent', LBL.hardware, GROUPS.metals, def, 0.1, help, when);

const upholsterySlot = (materials: readonly string[], def: string, weight = 0.6, label = LBL.upholstery) =>
  slot('surface', label, materials, def, weight);

const shapeChoices = (extra: Partial<ChoiceItem> = {}): ChoiceItem[] => [
  ch('rect', 'ចតុកោណកែង', 'Rectangle'),
  ch('soft', 'ជ្រុងមូល', 'Soft corners'),
  ch('oval', 'ពងក្រពើ', 'Oval'),
  ch('round', 'មូល', 'Round'),
].map((c) => ({ ...c, ...extra }));

const isRoundShape = (o: Record<string, OptionValue>) => o.shape === 'round';

// Round pieces keep depth equal to width.
const keepRound =
  (isRound: (o: Record<string, OptionValue>) => boolean) =>
  (cfg: Config): Config =>
    isRound(cfg.opts) ? { ...cfg, d: cfg.w } : cfg;


// ── The catalog ────────────────────────────────────────────────────────────

const armchair: Product = {
  id: 'armchair',
  sku: 'AS-KH-104',
  kind: 'lounge',
  category: 'seating',
  name: L('កៅអីវេរ៉ា អង្គរ', 'Vera Angkor Lounge Chair'),
  tagline: L(
    'កៅអីសម្រាកទាប និងស្រួល មានគ្រោងឈើខ្មែរ និងស្បែកដេរដោយដៃ។',
    'A deep, low lounge chair with a Khmer hardwood frame and hand-stitched leather.',
  ),
  basePrice: 3450,
  dims: { w: dim(650, 780, 1000), d: dim(700, 820, 950), h: dim(650, 740, 900) },
  sizeCurve: SIZE.seating,
  slots: [
    slot('frame', LBL.frame, GROUPS.timbersShort, 'beng', 0.35),
    upholsterySlot([...GROUPS.leathers, 'emerald-silk', 'indigo', 'linen'], 'burgundy'),
    hardwareSlot('brass', L('ម្ជុលភ្ជាប់ និងគម្របជើង', 'Joint pins and leg caps')),
  ],
  options: [
    choice('arms', L('ដៃកៅអី', 'Armrests'), [
      ch('wood', 'ឈើ', 'Timber'),
      ch('upholstered', 'ស្រោបស្បែក', 'Upholstered'),
      ch('none', 'គ្មានដៃ', 'No arms', { flat: -120 }),
    ], 'wood'),
    choice('legs', LBL.legsOpt, [ch('tapered', 'ស្តួច', 'Tapered'), ch('square', 'បួនជ្រុង', 'Square')], 'tapered'),
    FEEL('medium'),
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 780, 820, 740),
    preset('grand', 'ទូលាយ', 'Grand', 880, 860, 760),
  ],
  density: 51,
  leadWeeks: [4, 6],
  stockDays: 5,
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.upholstered,
  construction: CONSTRUCTION.upholstered,
  insights: (c) => [
    ins('seat', `កម្ពស់កៅអី ${cm(loungeSeatHeightMm(c.h))} cm`, `Seat height ${cm(loungeSeatHeightMm(c.h))} cm`),
  ],
  keywords: ['lounge', 'chair', 'leather', 'កៅអី'],
};

const sofa: Product = {
  id: 'sofa',
  sku: 'AS-KH-208',
  kind: 'sofa',
  category: 'seating',
  name: L('សាឡុងសូលីស ប៊ូក្លេ', 'Solis Bouclé Sofa'),
  tagline: L(
    'សាឡុងទូលាយមានដៃកោងទន់ៗ។ បង្កើន ឬបន្ថយទទឹង នោះចំនួនកៅអីក៏ប្រែតាម។',
    'A generous sofa with soft rounded arms. Make it wider and it gains a seat.',
  ),
  basePrice: 6850,
  dims: { w: dim(1500, 2420, 3600, 20), d: dim(850, 980, 1100), h: dim(680, 760, 880) },
  sizeCurve: { w: 0.95, d: 0.45, h: 0.2 },
  slots: [
    slot('frame', L('ឈើជើង និងគល់', 'Leg & plinth timber'), GROUPS.timbersShort, 'koki', 0.2),
    upholsterySlot([...GROUPS.boucles, 'linen', 'indigo', 'cognac', 'basalt'], 'chalk', 0.7),
    hardwareSlot('brass', L('គម្របជើង', 'Leg caps'), (o) => o.base === 'legs'),
  ],
  options: [
    choice('arms', L('ដៃសាឡុង', 'Arm style'), [ch('slim', 'ស្តើង', 'Slim'), ch('wide', 'ទូលាយ', 'Wide')], 'slim'),
    choice('base', LBL.base, [ch('legs', 'ជើងខ្ពស់', 'Raised legs'), ch('plinth', 'គល់ទាប', 'Low plinth')], 'plinth'),
    FEEL('medium'),
  ],
  presets: [
    preset('two', '២ កៅអី', '2-seat', 1800, 950, 760),
    preset('three', '៣ កៅអី', '3-seat', 2420, 980, 760),
    preset('four', '៤ កៅអី', '4-seat', 3000, 1000, 760),
  ],
  density: 43,
  leadWeeks: [5, 7],
  warranty: L('ធានាគ្រោង និងរ៉ឺស័រ ១៥ ឆ្នាំ', '15-year frame & spring guarantee'),
  origin: L('ផលិតនៅភ្នំពេញ និងសៀមរាប', 'Made in Phnom Penh & Siem Reap'),
  care: CARE.upholstered,
  construction: CONSTRUCTION.upholstered,
  insights: (c) => {
    const n = sofaSeats(c.w, String(c.opts.arms));
    return [
      ins('seats', `អង្គុយបាន ${n} នាក់`, `Seats ${n}`),
      ins('seatH', `កម្ពស់កៅអី ${cm(sofaSeatHeightMm(c.h))} cm`, `Seat height ${cm(sofaSeatHeightMm(c.h))} cm`),
    ];
  },
  keywords: ['sofa', 'couch', 'សាឡុង'],
};

const diningChair: Product = {
  id: 'diningChair',
  sku: 'AS-KH-112',
  kind: 'diningChair',
  category: 'seating',
  name: L('កៅអីបាយបាយ័ន', 'Bayon Dining Chair'),
  tagline: L('កៅអីបាយស្រាល និងរឹងមាំ មានខ្នងផ្តៅត្បាញ។', 'A light, strong dining chair with a woven cane back.'),
  basePrice: 680,
  dims: { w: dim(420, 480, 600), d: dim(480, 540, 640), h: dim(780, 830, 950) },
  sizeCurve: SIZE.seating,
  slots: [
    slot('frame', LBL.frame, GROUPS.timbers, 'koki', 0.45),
    upholsterySlot([...GROUPS.fabrics.slice(0, 4), ...GROUPS.leathers], 'linen', 0.45, L('កៅអីអង្គុយ', 'Seat cushion')),
    slot('accent', L('ផ្តៅខ្នង', 'Cane back'), GROUPS.canes, 'cane-natural', 0.2, undefined, (o) => o.back === 'cane'),
  ],
  options: [
    choice('back', L('ខ្នងកៅអី', 'Back'), [
      ch('cane', 'ផ្តៅត្បាញ', 'Woven cane'),
      ch('slat', 'បន្ទះឈើ', 'Timber slats'),
      ch('upholstered', 'ស្រោបក្រណាត់', 'Upholstered'),
    ], 'cane'),
    choice('seat', L('កៅអីអង្គុយ', 'Seat'), [
      ch('upholstered', 'ទន់ ស្រោបក្រណាត់', 'Cushioned'),
      ch('wood', 'ឈើសុទ្ធ', 'Solid timber'),
    ], 'upholstered'),
    toggle('arms', L('មានដៃកៅអី', 'Add armrests'), false, { flat: 90 }),
    choice('legs', LBL.legsOpt, [ch('tapered', 'ស្តួច', 'Tapered'), ch('square', 'បួនជ្រុង', 'Square')], 'tapered'),
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 480, 540, 830),
    preset('comfort', 'ស្រួលជាង', 'Comfort', 540, 580, 800),
  ],
  density: 28,
  leadWeeks: [3, 4],
  stockDays: 7,
  warranty: WARRANTY.y15,
  origin: ORIGIN.kc,
  care: CARE.timber,
  construction: CONSTRUCTION.timber,
  insights: () => [ins('seatH', 'កម្ពស់កៅអី ៤៥ cm សមស្របនឹងតុបាយស្តង់ដារ', 'Seat height 45 cm, right for a standard dining table')],
  keywords: ['dining', 'chair', 'cane'],
};

const barStool: Product = {
  id: 'barStool',
  sku: 'AS-KH-118',
  kind: 'stool',
  category: 'seating',
  name: L('កៅអីខ្ពស់កំពត', 'Kampot Counter Stool'),
  tagline: L(
    'កៅអីខ្ពស់រឹងមាំសម្រាប់តុបារ និងតុផ្ទះបាយ មានកន្លែងដាក់ជើង។',
    'A sturdy stool for kitchen counters and bars, with a footrest that takes the weight.',
  ),
  basePrice: 420,
  heightLabel: L('កម្ពស់កៅអី', 'Seat height'),
  dims: { w: dim(320, 380, 480, 10), d: dim(320, 380, 480, 10), h: dim(550, 650, 800, 10) },
  sizeCurve: SIZE.seating,
  slots: [
    slot('frame', LBL.frame, GROUPS.timbers, 'beng', 0.4),
    upholsterySlot([...GROUPS.leathers, 'linen', 'indigo', 'oat'], 'basalt', 0.4, L('កៅអីអង្គុយ', 'Seat cushion')),
    hardwareSlot('brass', L('កន្លែងដាក់ជើង', 'Footrest ring')),
  ],
  options: [
    choice('seat', L('រូបរាងកៅអី', 'Seat shape'), [ch('round', 'មូល', 'Round'), ch('square', 'ការ៉េ', 'Square')], 'round'),
    choice('legs', L('ចំនួនជើង', 'Legs'), [ch('four', '៤ ជើង', 'Four legs'), ch('three', '៣ ជើង', 'Three legs')], 'four'),
    choice('back', L('ខ្នង', 'Backrest'), [ch('none', 'គ្មាន', 'None'), ch('low', 'ខ្នងទាប', 'Low back', { flat: 60 })], 'none'),
  ],
  presets: [
    preset('counter', 'កៅអីតុផ្ទះបាយ', 'Counter', 380, 380, 650),
    preset('bar', 'កៅអីតុបារ', 'Bar', 380, 380, 750),
  ],
  density: 43,
  leadWeeks: [3, 4],
  stockDays: 7,
  roundWhen: (o) => o.seat === 'round',
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.upholstered,
  construction: CONSTRUCTION.timber,
  constrain: keepRound((o) => o.seat === 'round'),
  insights: (c) => [
    ins(
      'fit',
      `សមនឹងតុកម្ពស់ ${cm(c.h + 280)}–${cm(c.h + 330)} cm`,
      `Pairs with a counter about ${cm(c.h + 280)}–${cm(c.h + 330)} cm high`,
    ),
  ],
  keywords: ['stool', 'bar', 'counter'],
};

const bench: Product = {
  id: 'bench',
  sku: 'AS-KH-126',
  kind: 'bench',
  category: 'seating',
  name: L('កៅអីវែងរានហាល', 'Veranda Bench'),
  tagline: L('កៅអីវែងតូច សម្រាប់មាត់ទ្វារ ចុងគ្រែ ឬជិតបង្អួច។', 'A slim bench for the entry, the foot of a bed, or a window seat.'),
  basePrice: 890,
  dims: { w: dim(700, 1200, 2000, 20), d: dim(300, 400, 520), h: dim(380, 450, 520) },
  sizeCurve: { w: 0.9, d: 0.5, h: 0.2 },
  slots: [
    slot('frame', LBL.frame, GROUPS.timbers, 'koki', 0.4),
    upholsterySlot([...GROUPS.fabrics.slice(0, 4), ...GROUPS.boucles, ...GROUPS.leathers], 'linen', 0.5, L('កម្រាលអង្គុយ', 'Seat pad'), ),
    hardwareSlot('brass', undefined, () => false),
  ],
  options: [
    choice('top', L('ផ្ទៃអង្គុយ', 'Seat'), [ch('upholstered', 'ពូកទន់', 'Cushioned'), ch('timber', 'ឈើសុទ្ធ', 'Solid timber')], 'upholstered'),
    choice('legs', LBL.legsOpt, [
      ch('slab', 'ជើងបន្ទះ', 'Slab ends'),
      ch('four', '៤ ជើង', 'Four legs'),
      ch('plinth', 'គល់ទាប', 'Low plinth'),
    ], 'slab'),
  ],
  presets: [
    preset('entry', 'មាត់ទ្វារ', 'Entry', 1000, 380, 450),
    preset('bedEnd', 'ចុងគ្រែ', 'Bed end', 1500, 420, 460),
  ],
  density: 65,
  leadWeeks: [3, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.upholstered,
  construction: CONSTRUCTION.timber,
  insights: (c) => {
    const n = benchSeats(c.w);
    return [ins('seats', `អង្គុយបាន ${n} នាក់`, `Seats ${n}`)];
  },
  keywords: ['bench', 'entry'],
};

const ottoman: Product = {
  id: 'ottoman',
  sku: 'AS-KH-132',
  kind: 'ottoman',
  category: 'seating',
  name: L('កៅអីទាបផ្កាឈូក', 'Lotus Ottoman'),
  tagline: L('កៅអីទាបទន់ ប្រើជាទីដាក់ជើង ឬកន្លែងអង្គុយបន្ថែម។', 'A soft, low seat that doubles as a footrest or an extra place to sit.'),
  basePrice: 520,
  dims: { w: dim(380, 560, 1000, 10), d: dim(380, 560, 1000, 10), h: dim(300, 380, 480) },
  sizeCurve: { w: 0.9, d: 0.9, h: 0.3 },
  slots: [
    upholsterySlot([...GROUPS.boucles, ...GROUPS.fabrics, ...GROUPS.leathers], 'oat', 0.7),
    slot('frame', LBL.legs, GROUPS.timbers, 'koki', 0.2, undefined, (o) => o.base === 'legs'),
  ],
  options: [
    choice('shape', L('រូបរាង', 'Shape'), [ch('round', 'មូល', 'Round'), ch('square', 'ការ៉េ', 'Square')], 'round'),
    choice('base', LBL.base, [
      ch('legs', 'ជើងឈើ', 'Timber legs'),
      ch('plinth', 'គល់ទាប', 'Low plinth'),
      ch('floor', 'ដាក់លើដី', 'Sits on the floor'),
    ], 'legs'),
  ],
  presets: [
    preset('pouf', 'តូច', 'Pouf', 560, 560, 380),
    preset('coffee', 'ធំ (ជំនួសតុកាហ្វេ)', 'Large (coffee-table size)', 900, 900, 400),
  ],
  density: 59,
  leadWeeks: [3, 4],
  stockDays: 7,
  roundWhen: (o) => o.shape === 'round',
  constrain: keepRound((o) => o.shape === 'round'),
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.upholstered,
  construction: CONSTRUCTION.upholstered,
  keywords: ['ottoman', 'pouf', 'footstool'],
};

const diningTable: Product = {
  id: 'diningTable',
  sku: 'AS-KH-312',
  kind: 'table',
  variant: 'dining',
  category: 'tables',
  name: L('តុបាយបាយ័ន', 'Bayon Dining Table'),
  tagline: L(
    'តុឈើរឹងមាំភ្ជាប់ដោយសោមេអំបៅ។ ជ្រើសរូបរាង ជើង និងចំនួនអ្នកអង្គុយតាមចិត្ត។',
    'A solid-timber table with butterfly joints. Choose the shape, the legs, and how many it seats.',
  ),
  basePrice: 4890,
  dims: { w: dim(1000, 2200, 3200, 20), d: dim(800, 1000, 1200), h: dim(700, 750, 780) },
  sizeCurve: SIZE.tables,
  slots: [
    slot('surface', LBL.top, [...GROUPS.timbers, ...GROUPS.stones], 'beng', 0.6),
    slot('frame', LBL.legs, GROUPS.timbers, 'beng', 0.25),
    hardwareSlot('brass', L('សោមេអំបៅ', 'Butterfly keys')),
  ],
  options: [
    choice('shape', LBL.shape, shapeChoices(), 'rect'),
    choice('legs', LBL.legsOpt, [
      ch('trestle', 'ជើងបន្ទះ', 'Trestle ends', { hidden: isRoundShape }),
      ch('four', '៤ ជើង', 'Four legs'),
      ch('pedestal', 'ជើងតែមួយ', 'Central pedestal'),
    ], 'trestle'),
    choice('thickness', L('កម្រាស់ផ្ទៃតុ', 'Top thickness'), [
      ch('slim', 'ស្តើង ៣០ mm', 'Slim 30 mm'),
      ch('regular', 'ធម្មតា ៤៥ mm', 'Regular 45 mm'),
      ch('bold', 'ក្រាស់ ៧០ mm', 'Bold 70 mm', { pct: 0.06 }),
    ], 'regular'),
  ],
  presets: [
    preset('six', '៦ កៅអី', 'Seats 6', 1800, 900, 750),
    preset('eight', '៨ កៅអី', 'Seats 8', 2200, 1000, 750),
    preset('ten', '១០ កៅអី', 'Seats 10', 2800, 1050, 750),
    preset('round', 'តុមូល ៤ នាក់', 'Round for 4', 1200, 1200, 750, { shape: 'round', legs: 'pedestal' }),
  ],
  density: 68,
  leadWeeks: [4, 6],
  roundWhen: isRoundShape,
  constrain: (cfg) => {
    let c = keepRound(isRoundShape)(cfg);
    if (c.opts.shape === 'round' && c.opts.legs === 'trestle') c = { ...c, opts: { ...c.opts, legs: 'pedestal' } };
    return c;
  },
  warranty: WARRANTY.y25,
  origin: ORIGIN.kc,
  care: CARE.stone,
  construction: CONSTRUCTION.table,
  insights: (c) => {
    const [a, b] = tableSeats(String(c.opts.shape), c.w, c.d);
    const range = a === b ? `${a}` : `${a}–${b}`;
    return [ins('seats', `អង្គុយបាន ${range} នាក់`, `Seats ${range}`)];
  },
  keywords: ['dining', 'table', 'តុបាយ'],
};

const coffeeTable: Product = {
  id: 'coffeeTable',
  sku: 'AS-KH-318',
  kind: 'table',
  variant: 'coffee',
  category: 'tables',
  name: L('តុកាហ្វេមេគង្គ', 'Mekong Coffee Table'),
  tagline: L(
    'តុទាបសម្រាប់កណ្តាលបន្ទប់ ធ្វើពីឈើ ឬថ្ម មានធ្នើរខាងក្រោមតាមជម្រើស។',
    'A low table for the middle of the room, in timber or stone, with an optional shelf below.',
  ),
  basePrice: 1180,
  dims: { w: dim(600, 1100, 1400), d: dim(500, 700, 900), h: dim(300, 400, 500) },
  sizeCurve: SIZE.tables,
  slots: [
    slot('surface', LBL.top, [...GROUPS.timbers, ...GROUPS.stones], 'koki', 0.6),
    slot('frame', LBL.legs, GROUPS.timbers, 'koki', 0.2),
    hardwareSlot('brass', L('ចំណុចភ្ជាប់', 'Metal details')),
  ],
  options: [
    choice('shape', LBL.shape, shapeChoices(), 'soft'),
    choice('legs', LBL.legsOpt, [
      ch('four', '៤ ជើង', 'Four legs'),
      ch('pedestal', 'ជើងតែមួយ', 'Central pedestal'),
      ch('slab', 'ជើងបន្ទះ', 'Slab ends', { hidden: isRoundShape }),
    ], 'four'),
    toggle('shelf', L('ធ្នើរខាងក្រោម', 'Lower shelf'), false, { flat: 120, when: (o) => o.legs !== 'pedestal' }),
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 1100, 700, 400),
    preset('compact', 'តូច', 'Compact', 850, 550, 380),
    preset('round', 'មូល', 'Round', 900, 900, 380, { shape: 'round', legs: 'pedestal' }),
  ],
  density: 91,
  leadWeeks: [3, 5],
  roundWhen: isRoundShape,
  constrain: (cfg) => {
    let c = keepRound(isRoundShape)(cfg);
    if (c.opts.shape === 'round' && c.opts.legs === 'slab') c = { ...c, opts: { ...c.opts, legs: 'pedestal' } };
    if (c.opts.legs === 'pedestal' && c.opts.shelf) c = { ...c, opts: { ...c.opts, shelf: false } };
    return c;
  },
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.stone,
  construction: CONSTRUCTION.table,
  insights: (c) => [
    ins(
      'sofa',
      `ល្អជាមួយសាឡុងទទឹង ${cm(c.w * 2)}+ cm`,
      `Sits well beside a sofa ${cm(c.w * 2)} cm wide or more`,
    ),
  ],
  keywords: ['coffee', 'table', 'low'],
};

const sideTable: Product = {
  id: 'sideTable',
  sku: 'AS-KH-322',
  kind: 'table',
  variant: 'side',
  category: 'tables',
  name: L('តុតូចសាលា', 'Sala Side Table'),
  tagline: L('តុតូចដាក់ក្បែរសាឡុង គ្រែ ឬកៅអីអានសៀវភៅ។', 'A small table that fits beside a sofa, a bed or a reading chair.'),
  basePrice: 540,
  dims: { w: dim(350, 450, 650, 10), d: dim(350, 450, 650, 10), h: dim(400, 520, 650) },
  sizeCurve: { w: 0.9, d: 0.9, h: 0.3 },
  slots: [
    slot('surface', LBL.top, [...GROUPS.timbers, ...GROUPS.stones], 'koki', 0.55),
    slot('frame', LBL.legs, GROUPS.timbers, 'koki', 0.2),
    hardwareSlot('brass', undefined, () => false),
  ],
  options: [
    choice('shape', LBL.shape, [ch('round', 'មូល', 'Round'), ch('soft', 'ការ៉េជ្រុងមូល', 'Soft square')], 'round'),
    choice('legs', LBL.legsOpt, [
      ch('pedestal', 'ជើងតែមួយ', 'Central pedestal'),
      ch('tripod', '៣ ជើង', 'Three legs'),
      ch('four', '៤ ជើង', 'Four legs'),
    ], 'pedestal'),
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 450, 450, 520),
    preset('tall', 'ខ្ពស់', 'Tall', 400, 400, 600),
  ],
  density: 86,
  leadWeeks: [2, 3],
  stockDays: 5,
  roundWhen: isRoundShape,
  constrain: keepRound(isRoundShape),
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.stone,
  construction: CONSTRUCTION.table,
  keywords: ['side', 'table', 'bedside'],
};

const desk: Product = {
  id: 'desk',
  sku: 'AS-KH-330',
  kind: 'table',
  variant: 'desk',
  category: 'tables',
  name: L('តុធ្វើការអង្គរ', 'Angkor Writing Desk'),
  tagline: L('តុធ្វើការស្អាតត្រឹមត្រូវ មានថតអូស និងរន្ធខ្សែតាមជម្រើស។', 'A calm, uncluttered desk with optional drawers and a cable hole.'),
  basePrice: 2150,
  dims: { w: dim(1000, 1400, 2000, 20), d: dim(550, 700, 850), h: dim(700, 740, 780) },
  sizeCurve: SIZE.tables,
  slots: [
    slot('surface', LBL.top, GROUPS.timbers, 'koki', 0.55),
    slot('frame', LBL.legs, GROUPS.timbers, 'koki', 0.25),
    hardwareSlot('brass', L('ដៃចាប់ថត', 'Drawer pulls')),
  ],
  options: [
    choice('drawers', L('ថតអូស', 'Drawers'), [
      ch('none', 'គ្មាន', 'None'),
      ch('right', 'ខាងស្តាំ', 'Right side', { flat: 380 }),
      ch('left', 'ខាងឆ្វេង', 'Left side', { flat: 380 }),
    ], 'right'),
    choice('legs', LBL.legsOpt, [ch('four', '៤ ជើង', 'Four legs'), ch('panel', 'ជើងបន្ទះ', 'Panel ends')], 'four'),
    toggle('cable', L('រន្ធខ្សែ', 'Cable hole'), true, { flat: 25 }),
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 1400, 700, 740),
    preset('compact', 'តូច', 'Compact', 1100, 600, 740),
    preset('large', 'ធំ', 'Large', 1800, 800, 740),
  ],
  density: 52,
  leadWeeks: [4, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.timber,
  construction: CONSTRUCTION.timber,
  insights: (c) => [
    ins('screens', c.w >= 1600 ? 'ល្មមសម្រាប់ម៉ូនីទ័រពីរ' : 'ល្មមសម្រាប់កុំព្យូទ័រយួរដៃ ឬម៉ូនីទ័រមួយ', c.w >= 1600 ? 'Room for two monitors' : 'Room for a laptop or one monitor'),
  ],
  keywords: ['desk', 'work', 'office'],
};

const consoleTable: Product = {
  id: 'console',
  sku: 'AS-KH-334',
  kind: 'table',
  variant: 'console',
  category: 'tables',
  name: L('តុជិតជញ្ជាំងនាគ', 'Naga Console Table'),
  tagline: L('តុរាបសម្រាប់ផ្លូវចូល ឬខាងក្រោយសាឡុង ជម្រៅតាមតម្រូវការ។', 'A shallow table for the hallway or behind a sofa, only as deep as you need.'),
  basePrice: 1290,
  dims: { w: dim(800, 1200, 1800, 20), d: dim(250, 330, 450), h: dim(700, 800, 950) },
  sizeCurve: SIZE.tables,
  slots: [
    slot('surface', LBL.top, [...GROUPS.timbers, ...GROUPS.stones], 'beng', 0.55),
    slot('frame', LBL.legs, GROUPS.timbers, 'beng', 0.25),
    hardwareSlot('brass', L('ដៃចាប់ និងគ្រឿងលម្អ', 'Pulls and details'), (o) => !!o.drawer),
  ],
  options: [
    choice('legs', LBL.legsOpt, [ch('four', '៤ ជើង', 'Four legs'), ch('panel', 'ជើងបន្ទះ', 'Panel ends')], 'four'),
    toggle('shelf', L('ធ្នើរខាងក្រោម', 'Lower shelf'), true, { flat: 90 }),
    toggle('drawer', L('ថតអូសមួយ', 'One drawer'), false, { flat: 150 }),
  ],
  presets: [
    preset('hall', 'ផ្លូវចូល', 'Hallway', 1200, 330, 800),
    preset('sofa', 'ខាងក្រោយសាឡុង', 'Behind a sofa', 1600, 350, 780),
  ],
  density: 69,
  leadWeeks: [3, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.timber,
  construction: CONSTRUCTION.table,
  keywords: ['console', 'hall', 'entry'],
};

const credenza: Product = {
  id: 'credenza',
  sku: 'AS-KH-416',
  kind: 'cabinet',
  variant: 'credenza',
  category: 'storage',
  name: L('ទូទាបរំដួល ផ្តៅខ្មែរ', 'Romduol Cane Credenza'),
  tagline: L('ទូទាបមានទ្វារផ្តៅត្បាញ និងតួឈើរឹងមាំ។', 'A low sideboard with woven cane doors and a solid hardwood body.'),
  basePrice: 3980,
  dims: { w: dim(1200, 1960, 2600, 20), d: dim(380, 460, 550), h: dim(500, 740, 900) },
  sizeCurve: SIZE.storage,
  slots: [
    slot('frame', L('ឈើតួទូ', 'Cabinet timber'), GROUPS.timbers, 'beng', 0.35),
    slot('surface', LBL.front, [...GROUPS.canes, ...GROUPS.timbersShort, ...GROUPS.lacquers], 'cane-natural', 0.4),
    hardwareSlot('brass', L('ដៃចាប់ និងកណ្តាល', 'Handles and hinges'), (o) => o.handles !== 'none'),
  ],
  options: [
    choice('layout', L('ទំរង់មុខទូ', 'Layout'), [
      ch('doors', 'ទ្វារទាំងអស់', 'All doors'),
      ch('mixed', 'ទ្វារ និងថតកណ្តាល', 'Doors with centre drawers', { flat: 220 }),
      ch('drawers', 'ថតទាំងអស់', 'All drawers', { flat: 480 }),
    ], 'doors'),
    FRONT_STYLE,
    choice('base', LBL.base, [ch('legs', 'ជើងស្តួច', 'Tapered legs'), ch('plinth', 'គល់ទាប', 'Low plinth')], 'legs'),
    HANDLES,
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ ៤ ទ្វារ', 'Standard, 4 doors', 1960, 460, 740),
    preset('compact', 'តូច ៣ ទ្វារ', 'Compact, 3 doors', 1500, 450, 720),
    preset('long', 'វែង ៦ ទ្វារ', 'Long, 6 doors', 2600, 480, 740),
  ],
  density: 96,
  leadWeeks: [4, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.sr,
  care: CARE.timber,
  construction: CONSTRUCTION.cabinet,
  keywords: ['credenza', 'sideboard', 'cabinet', 'ទូ'],
};

const tvUnit: Product = {
  id: 'tvUnit',
  sku: 'AS-KH-424',
  kind: 'cabinet',
  variant: 'media',
  category: 'storage',
  name: L('ទូទូរទស្សន៍គូលែន', 'Kulen Media Console'),
  tagline: L(
    'ទូទាបសម្រាប់ទូរទស្សន៍ មានកន្លែងបើកចំហកណ្តាល និងទូបិទនៅសងខាង។',
    'A low media console with an open bay for your TV gear and closed storage at the sides.',
  ),
  basePrice: 2480,
  dims: { w: dim(1200, 1800, 2400, 20), d: dim(350, 420, 520), h: dim(350, 440, 550) },
  sizeCurve: SIZE.storage,
  slots: [
    slot('frame', L('ឈើតួទូ', 'Cabinet timber'), GROUPS.timbers, 'koki', 0.35),
    slot('surface', LBL.front, [...GROUPS.timbersShort, ...GROUPS.canes, ...GROUPS.lacquers], 'beng', 0.4),
    hardwareSlot('brass', L('ដៃចាប់', 'Handles'), (o) => o.handles !== 'none'),
  ],
  options: [
    toggle('openBay', L('កន្លែងបើកចំហកណ្តាល', 'Open centre bay'), true),
    FRONT_STYLE,
    choice('base', LBL.base, [ch('legs', 'ជើងស្តួច', 'Tapered legs'), ch('plinth', 'គល់ទាប', 'Low plinth')], 'legs'),
    HANDLES,
  ],
  presets: [
    preset('standard', 'សម្រាប់ទូរទស្សន៍ ៥៥″', 'For a 55″ TV', 1500, 400, 440),
    preset('large', 'សម្រាប់ទូរទស្សន៍ ៦៥″', 'For a 65″ TV', 1800, 420, 440),
    preset('xl', 'សម្រាប់ទូរទស្សន៍ ៧៥″', 'For a 75″ TV', 2200, 440, 460),
  ],
  density: 126,
  leadWeeks: [4, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.sr,
  care: CARE.timber,
  construction: CONSTRUCTION.cabinet,
  insights: (c) => {
    const inches = Math.round((c.w / 25.4) * 0.78 / 5) * 5;
    return [ins('tv', `សមនឹងទូរទស្សន៍រហូតដល់ ${inches}″`, `Suits a TV up to about ${inches}″`)];
  },
  keywords: ['tv', 'media', 'console', 'ទូរទស្សន៍'],
};

const bookshelf: Product = {
  id: 'bookshelf',
  sku: 'AS-KH-432',
  kind: 'shelf',
  category: 'storage',
  name: L('ធ្នើរសៀវភៅវិហារ', 'Pagoda Bookcase'),
  tagline: L(
    'ធ្នើរសៀវភៅខ្ពស់ ដែលជាន់ និងបន្ទះខណ្ឌប្រែតាមកម្ពស់ និងទទឹងដែលអ្នកជ្រើស។',
    'A tall bookcase whose shelves and dividers adjust to the height and width you choose.',
  ),
  basePrice: 1980,
  dims: { w: dim(600, 1000, 1600, 20), d: dim(280, 340, 450), h: dim(900, 1900, 2400, 20) },
  sizeCurve: { w: 0.85, d: 0.4, h: 0.8 },
  slots: [
    slot('frame', LBL.frame, GROUPS.timbers, 'koki', 0.55),
    slot('surface', L('ទ្វារខាងក្រោម', 'Lower doors'), [...GROUPS.canes, ...GROUPS.timbersShort, ...GROUPS.lacquers], 'cane-natural', 0.2, undefined, (o) => !!o.base),
    hardwareSlot('brass', L('ដៃចាប់', 'Handles'), (o) => !!o.base),
  ],
  options: [
    toggle('back', L('បន្ទះខាងក្រោយ', 'Back panel'), true, { flat: 80 }),
    toggle('base', L('ទូបិទខាងក្រោម', 'Closed cabinet below'), false, { flat: 260 }),
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 1000, 340, 1900),
    preset('low', 'ទាប', 'Low', 1200, 330, 1100),
    preset('wall', 'ជាប់ជញ្ជាំងទាំងមូល', 'Wall unit', 1600, 380, 2300),
  ],
  density: 80,
  leadWeeks: [3, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.kc,
  care: CARE.timber,
  construction: CONSTRUCTION.timber,
  insights: (c) => {
    const rows = Math.max(2, Math.round(c.h / 340));
    return [ins('rows', `ជាន់ដាក់សៀវភៅ ${rows}`, `${rows} shelves`)];
  },
  keywords: ['bookcase', 'shelf', 'books', 'ធ្នើរ'],
};

const wardrobe: Product = {
  id: 'wardrobe',
  sku: 'AS-KH-440',
  kind: 'cabinet',
  variant: 'wardrobe',
  category: 'storage',
  name: L('ទូខោអាវតាកែវ', 'Takeo Wardrobe'),
  tagline: L('ទូខោអាវកម្ពស់ពេញ មានទ្វារចែកស្មើគ្នាតាមទទឹង។', 'A full-height wardrobe with doors that divide evenly across the width.'),
  basePrice: 4200,
  dims: { w: dim(900, 1600, 2400, 20), d: dim(500, 600, 700), h: dim(1800, 2200, 2600, 20) },
  sizeCurve: { w: 0.9, d: 0.5, h: 0.7 },
  slots: [
    slot('frame', L('ឈើតួទូ', 'Cabinet timber'), GROUPS.timbers, 'koki', 0.3),
    slot('surface', LBL.front, [...GROUPS.timbersShort, ...GROUPS.lacquers, ...GROUPS.canes], 'lacquer-ivory', 0.45),
    hardwareSlot('brass', L('ដៃចាប់', 'Handles'), (o) => o.handles !== 'none'),
  ],
  options: [
    FRONT_STYLE,
    HANDLES,
    choice('interior', L('ខាងក្នុងទូ', 'Inside'), [
      ch('mixed', 'សម្រាប់ព្យួរ និងធ្នើរ', 'Hanging rail and shelves'),
      ch('hanging', 'សម្រាប់ព្យួរអាវ', 'Mostly hanging'),
      ch('shelves', 'ធ្នើរពេញ', 'Mostly shelves'),
    ], 'mixed', { help: L('មិនប៉ះពាល់តម្លៃទេ។', 'No effect on price.') }),
  ],
  presets: [
    preset('two', 'ទ្វារ ២', '2 doors', 1000, 580, 2200),
    preset('three', 'ទ្វារ ៣', '3 doors', 1600, 600, 2200),
    preset('four', 'ទ្វារ ៤', '4 doors', 2200, 620, 2300),
  ],
  density: 57,
  leadWeeks: [5, 7],
  warranty: WARRANTY.y15,
  origin: ORIGIN.tk,
  care: CARE.timber,
  construction: CONSTRUCTION.cabinet,
  insights: (c) => {
    const rail = Math.max(0, Math.floor((c.w - 100) / 10) / 10);
    return [ins('rail', `ប្រវែងបង្ហូរអាវអតិបរមា ~${rail} m`, `About ${rail} m of hanging space`)];
  },
  keywords: ['wardrobe', 'closet', 'ទូខោអាវ'],
};

const nightstand: Product = {
  id: 'nightstand',
  sku: 'AS-KH-514',
  kind: 'cabinet',
  variant: 'nightstand',
  category: 'bedroom',
  name: L('តុក្បែរគ្រែបាទី', 'Bati Nightstand'),
  tagline: L('តុតូចក្បែរគ្រែ មានថតអូស និងធ្នើរបើកចំហតាមចិត្ត។', 'A small bedside table with drawers and, if you like, an open shelf.'),
  basePrice: 760,
  dims: { w: dim(350, 480, 650, 10), d: dim(320, 400, 480, 10), h: dim(400, 520, 650) },
  sizeCurve: SIZE.storage,
  slots: [
    slot('frame', L('ឈើតួតុ', 'Body timber'), GROUPS.timbers, 'koki', 0.45),
    slot('surface', L('មុខថត', 'Drawer fronts'), [...GROUPS.timbersShort, ...GROUPS.canes, ...GROUPS.lacquers], 'beng', 0.3),
    hardwareSlot('brass', L('ដៃចាប់', 'Handles'), (o) => o.handles !== 'none'),
  ],
  options: [
    count('drawers', L('ចំនួនថតអូស', 'Drawers'), 1, 2, 3, { flatPer: 70 }),
    toggle('openShelf', L('ធ្នើរបើកចំហខាងក្រោម', 'Open shelf below'), false, { flat: 40 }),
    choice('base', LBL.base, [ch('legs', 'ជើងស្តួច', 'Tapered legs'), ch('plinth', 'គល់ទាប', 'Low plinth')], 'legs'),
    HANDLES,
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 480, 400, 520),
    preset('wide', 'ទូលាយ', 'Wide', 600, 420, 500),
  ],
  density: 160,
  leadWeeks: [3, 4],
  stockDays: 7,
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.timber,
  construction: CONSTRUCTION.cabinet,
  insights: (c) => [ins('height', `កម្ពស់ ${cm(c.h)} cm`, `Bedside height ${cm(c.h)} cm`)],
  keywords: ['nightstand', 'bedside', 'drawer'],
};

const dresser: Product = {
  id: 'dresser',
  sku: 'AS-KH-522',
  kind: 'cabinet',
  variant: 'dresser',
  category: 'bedroom',
  name: L('ទូថតកែប', 'Kep Chest of Drawers'),
  tagline: L('ទូថតច្រើនជាន់ ដែលចែកជាពីរជួរបញ្ឈរនៅពេលទទឹងធំ។', 'A chest of drawers that splits into two columns once it gets wide.'),
  basePrice: 2380,
  dims: { w: dim(800, 1200, 1800, 20), d: dim(400, 480, 560), h: dim(750, 900, 1200, 10) },
  sizeCurve: SIZE.storage,
  slots: [
    slot('frame', L('ឈើតួទូ', 'Body timber'), GROUPS.timbers, 'koki', 0.4),
    slot('surface', L('មុខថត', 'Drawer fronts'), [...GROUPS.timbersShort, ...GROUPS.lacquers, ...GROUPS.canes], 'beng', 0.35),
    hardwareSlot('brass', L('ដៃចាប់', 'Handles'), (o) => o.handles !== 'none'),
  ],
  options: [
    count('rows', L('ចំនួនជាន់ថត', 'Rows of drawers'), 3, 4, 6, { flatPer: 90 }),
    choice('base', LBL.base, [ch('legs', 'ជើងស្តួច', 'Tapered legs'), ch('plinth', 'គល់ទាប', 'Low plinth')], 'legs'),
    HANDLES,
  ],
  presets: [
    preset('standard', 'ស្តង់ដារ', 'Standard', 1200, 480, 900),
    preset('tall', 'ខ្ពស់', 'Tall', 800, 450, 1150),
    preset('wide', 'ទូលាយ', 'Wide', 1600, 500, 850),
  ],
  density: 135,
  leadWeeks: [4, 5],
  warranty: WARRANTY.y15,
  origin: ORIGIN.pp,
  care: CARE.timber,
  construction: CONSTRUCTION.cabinet,
  insights: (c) => {
    const cols = c.w > 1300 ? 2 : 1;
    const rows = Number(c.opts.rows ?? 4);
    return [ins('drawers', `ថតសរុប ${rows * cols}`, `${rows * cols} drawers in total`)];
  },
  keywords: ['dresser', 'drawers', 'chest'],
};

const bed: Product = {
  id: 'bed',
  sku: 'AS-KH-508',
  kind: 'bed',
  category: 'bedroom',
  name: L('គ្រែអាតេលីយេ ភ្នំពេញ', 'Phnom Penh Platform Bed'),
  tagline: L(
    'គ្រែទាប មានក្បាលគ្រែខ្ពស់។ ជ្រើសទំហំពូក ហើយគ្រោងគ្រែនឹងធ្វើតាម។',
    'A low platform bed with a tall headboard. Pick your mattress size and the frame is built around it.',
  ),
  basePrice: 5490,
  heightLabel: L('កម្ពស់ក្បាលគ្រែ', 'Headboard height'),
  dims: { w: dim(1000, 1920, 2200, 10), d: dim(1900, 2160, 2300, 20), h: dim(700, 1040, 1300) },
  sizeCurve: SIZE.bed,
  slots: [
    slot('frame', LBL.frame, GROUPS.timbers, 'neangnuon', 0.3),
    slot('surface', L('ក្បាលគ្រែ', 'Headboard'), [...GROUPS.fabrics.slice(0, 4), ...GROUPS.boucles, 'emerald-silk'], 'linen', 0.5),
    slot('accent', L('ស្បៃគ្រែ និងខ្នើយ', 'Throw & pillows'), ['takeo-silk', 'emerald-silk', 'indigo', 'linen', 'lotus'], 'takeo-silk', 0.2),
  ],
  options: [
    choice('headboard', L('ក្បាលគ្រែ', 'Headboard style'), [
      ch('channel', 'ស្រោបជាបន្ទះបញ្ឈរ', 'Vertical channels'),
      ch('slatted', 'បន្ទះឈើ', 'Timber slats'),
      ch('panel', 'ផ្ទាំងស្រោបរាបស្មើ', 'Smooth upholstered panel'),
    ], 'channel'),
    choice('frame', L('គ្រោងគ្រែ', 'Frame'), [ch('platform', 'គល់ទាប', 'Low platform'), ch('legs', 'ជើងលើក', 'Raised legs')], 'platform'),
    FEEL('medium'),
  ],
  presets: [
    preset('queen', 'ពូកធំ (Queen)', 'Queen mattress', 1620, 2160, 1040),
    preset('king', 'ពូកធំពិសេស (King)', 'King mattress', 1920, 2160, 1040),
    preset('superking', 'ពូកធំបំផុត (Super King)', 'Super King mattress', 2120, 2160, 1040),
    preset('double', 'ពូកពីរនាក់តូច', 'Double mattress', 1470, 2160, 1040),
  ],
  density: 22,
  leadWeeks: [5, 7],
  warranty: WARRANTY.y20,
  origin: ORIGIN.pp,
  care: CARE.upholstered,
  construction: CONSTRUCTION.bed,
  insights: (c) => {
    const { w, l, match } = bedMattress(c.w, c.d);
    return [
      match
        ? ins('mattress', `សមនឹងពូក ${match.km} ${cm(match.w)} × ${cm(match.l)} cm`, `Fits a ${match.en} mattress, ${cm(match.w)} × ${cm(match.l)} cm`)
        : ins('mattress', `ពូកផ្ទាល់ខ្លួន ${cm(w)} × ${cm(l)} cm`, `Fits a custom ${cm(w)} × ${cm(l)} cm mattress`),
    ];
  },
  keywords: ['bed', 'platform', 'bedroom', 'គ្រែ'],
};

const daybed: Product = {
  id: 'daybed',
  sku: 'AS-KH-624',
  kind: 'daybed',
  category: 'bedroom',
  name: L('គ្រែសាឡាទន្លេសាប', 'Tonle Sap Pavilion Daybed'),
  tagline: L('គ្រែសាឡាបែបខ្មែរ មានរនាបឈើ និងខ្នើយមូល។', 'A Khmer-style pavilion daybed with slatted rails and round bolsters.'),
  basePrice: 3650,
  dims: { w: dim(1600, 1980, 2400, 20), d: dim(750, 920, 1200), h: dim(450, 580, 800) },
  sizeCurve: SIZE.bed,
  slots: [
    slot('frame', LBL.frame, GROUPS.timbers, 'neangnuon', 0.3),
    upholsterySlot([...GROUPS.silks, 'sage', 'lotus', 'chalk'], 'takeo-silk', 0.6, L('ពូក និងខ្នើយ', 'Mattress & bolsters')),
  ],
  options: [
    toggle('backrail', L('រនាបខ្នង', 'Back rail'), true, { flat: 140 }),
    count('bolsters', L('ខ្នើយមូល', 'Round bolsters'), 0, 2, 3, { flatPer: 60 }),
    choice('base', LBL.base, [ch('posts', 'ជើងបួនជ្រុង', 'Corner posts'), ch('plinth', 'គល់ទាប', 'Low plinth')], 'posts'),
  ],
  presets: [
    preset('pavilion', 'ស្តង់ដារ', 'Standard', 1980, 920, 580),
    preset('deep', 'ជម្រៅធំ', 'Deep lounge', 2140, 1060, 580),
  ],
  density: 51,
  leadWeeks: [4, 6],
  stockDays: 7,
  warranty: WARRANTY.y15,
  origin: ORIGIN.tk,
  care: CARE.upholstered,
  construction: CONSTRUCTION.upholstered,
  keywords: ['daybed', 'sala', 'lounge'],
};

export const PRODUCTS: Product[] = [
  sofa,
  armchair,
  diningTable,
  bed,
  credenza,
  daybed,
  diningChair,
  coffeeTable,
  tvUnit,
  bookshelf,
  wardrobe,
  desk,
  nightstand,
  dresser,
  consoleTable,
  sideTable,
  barStool,
  bench,
  ottoman,
];

export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const CATEGORIES: { id: CategoryId; label: LocalizedText }[] = [
  { id: 'seating', label: L('កៅអី និងសាឡុង', 'Seating') },
  { id: 'tables', label: L('តុ', 'Tables') },
  { id: 'storage', label: L('ទូ និងធ្នើរ', 'Storage') },
  { id: 'bedroom', label: L('បន្ទប់គេង', 'Bedroom') },
];

export function getProduct(id: string | undefined | null): Product | undefined {
  return id ? PRODUCT_BY_ID[id] : undefined;
}

