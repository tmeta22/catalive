import type { LocalizedText } from '../i18n/translations';

export type { LocalizedText };

/** Texture / shading family used by the 3D engine. */
export type MaterialKind =
  | 'timber'
  | 'leather'
  | 'boucle'
  | 'fabric'
  | 'cane'
  | 'metal'
  | 'stone'
  | 'paint';

export interface Material {
  id: string;
  kind: MaterialKind;
  name: LocalizedText;
  note: LocalizedText;
  hex: string;
  roughness: number;
  /** 0 = included in the base price, 3 = most premium. */
  tier: 0 | 1 | 2 | 3;
}

/** Which part of the piece a material slot paints. */
export type SlotRole = 'frame' | 'surface' | 'accent';

export interface SlotSpec {
  id: SlotRole;
  label: LocalizedText;
  help?: LocalizedText;
  /** Material ids from the shared library. */
  materials: string[];
  default: string;
  /** Share of the sized base price that the premium tier applies to. */
  weight: number;
  /** Only show when the current options make this slot visible on the piece. */
  when?: (opts: Record<string, OptionValue>) => boolean;
}

export interface DimSpec {
  min: number;
  max: number;
  step: number;
  def: number;
}

export type CategoryId = 'seating' | 'tables' | 'storage' | 'bedroom';

export type OptionValue = string | number | boolean;

export interface ChoiceItem {
  id: string;
  label: LocalizedText;
  hint?: LocalizedText;
  /** Flat USD surcharge. */
  flat?: number;
  /** Surcharge as a fraction of the sized base price. */
  pct?: number;
  /** Hide this choice for incompatible combinations. */
  hidden?: (opts: Record<string, OptionValue>) => boolean;
}

export type OptionSpec =
  | {
      id: string;
      type: 'choice';
      label: LocalizedText;
      help?: LocalizedText;
      choices: ChoiceItem[];
      default: string;
      /** Only show when this predicate over other options holds. */
      when?: (opts: Record<string, OptionValue>) => boolean;
    }
  | {
      id: string;
      type: 'toggle';
      label: LocalizedText;
      help?: LocalizedText;
      default: boolean;
      flat?: number;
      pct?: number;
      when?: (opts: Record<string, OptionValue>) => boolean;
    }
  | {
      id: string;
      type: 'count';
      label: LocalizedText;
      help?: LocalizedText;
      min: number;
      max: number;
      default: number;
      flatPer?: number;
      when?: (opts: Record<string, OptionValue>) => boolean;
    };

export interface Preset {
  id: string;
  label: LocalizedText;
  w?: number;
  d?: number;
  h?: number;
  opts?: Record<string, OptionValue>;
}

/** Which procedural 3D builder draws the piece. */
export type BuilderKind =
  | 'lounge'
  | 'diningChair'
  | 'sofa'
  | 'stool'
  | 'bench'
  | 'ottoman'
  | 'table'
  | 'cabinet'
  | 'shelf'
  | 'bed'
  | 'daybed';

export interface Config {
  /** Millimetres. */
  w: number;
  d: number;
  h: number;
  slots: Partial<Record<SlotRole, string>>;
  opts: Record<string, OptionValue>;
  note: string;
}

export interface Insight {
  id: string;
  text: LocalizedText;
}

export interface Product {
  id: string;
  sku: string;
  kind: BuilderKind;
  /** Free-form variant passed to the builder (e.g. "desk", "tv"). */
  variant?: string;
  category: CategoryId;
  name: LocalizedText;
  tagline: LocalizedText;
  basePrice: number;
  /** Overrides the generic "Height" label (e.g. seat height for stools). */
  heightLabel?: LocalizedText;
  dims: { w: DimSpec; d: DimSpec; h: DimSpec };
  /** Price exponents: price grows with (w/w0)^a * (d/d0)^b * (h/h0)^c. */
  sizeCurve: { w: number; d: number; h: number };
  slots: SlotSpec[];
  options: OptionSpec[];
  presets: Preset[];
  /** Kilograms per cubic metre of bounding box, for the weight estimate. */
  density: number;
  leadWeeks: [number, number];
  /** Standard size in standard finishes ships from stock in this many days. */
  stockDays?: number;
  /** When true the piece is round: depth follows width and is shown as "diameter". */
  roundWhen?: (opts: Record<string, OptionValue>) => boolean;
  warranty: LocalizedText;
  origin: LocalizedText;
  care: LocalizedText;
  construction: LocalizedText;
  /** Force dependent values (e.g. round tables have equal width and depth). */
  constrain?: (cfg: Config) => Config;
  insights?: (cfg: Config) => Insight[];
  /** Plain-language "what is this" tags for filtering and search. */
  keywords?: string[];
}
