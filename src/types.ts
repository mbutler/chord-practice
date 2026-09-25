// Shared data model between the deck generator (build time) and the app (runtime).

/** 0 = Root position, 1 = Backwards (1st inversion), 2 = Middle (2nd inversion). */
export type Inversion = 0 | 1 | 2;

/** A concrete right-hand voicing: exact keys, lowest note first. */
export interface Voicing {
  symbol: string;          // chord symbol as written, e.g. "G/B", "Cmaj7"
  inversion: Inversion;    // inversion of the underlying triad shape
  midi: number[];          // MIDI note numbers, ascending (60 = middle C)
  names: string[];         // display note names, parallel to `midi`
}

/** One chord-to-chord move, described for the hint text. */
export interface Motion {
  held: string[];                          // notes that stay down
  moves: { from: string; to: string }[];   // fingers that move
}

interface CardBase {
  id: string;
  tier: 1 | 2 | 3;
  category: string;        // grouping label, e.g. "Chord Shapes", "Jazz Turnarounds"
  categoryId: string;      // stable slug for settings filters
  level: number;           // curriculum order for introducing new cards
  sequence: number;        // tie-break within a level
  sibling: string;         // cards sharing this are not introduced on the same day
  hint: string;
}

/** Tier 1: see a chord symbol, play the requested inversion (picked at review time). */
export interface ChordCard extends CardBase {
  kind: "chord";
  symbol: string;
  quality: string;         // e.g. "Minor 7th"
  shapeRule: string;       // how the PfA shape is built, e.g. "Minor triad, drop the root a whole step"
  inversions: Voicing[];   // index = Inversion
}

/** Tiers 2–3: play a progression starting from a given inversion. */
export interface ProgressionCard extends CardBase {
  kind: "progression";
  name: string;            // e.g. "ii – V – I"
  key: string;             // e.g. "Bb", "F#m"
  roman: string[];         // e.g. ["ii7", "V7", "Imaj7"]
  symbols: string[];       // e.g. ["Cm7", "F7", "Bbmaj7"]
  form?: string[];         // bar-by-bar chart when it differs from `symbols` (12-bar blues)
  startInversion: Inversion;
  steps: Voicing[];        // the voice-led answer, one per chord
  motions: Motion[];       // steps.length - 1 entries
  styles: string[];        // rhythm modifiers; one is picked at random per review
}

export type Card = ChordCard | ProgressionCard;

export interface Deck {
  name: string;
  version: string;
  generated: string;
  cards: Card[];
}

export const INVERSION_LABELS: Record<Inversion, { pfa: string; standard: string }> = {
  0: { pfa: "Root", standard: "Root position" },
  1: { pfa: "Backwards", standard: "1st inversion" },
  2: { pfa: "Middle", standard: "2nd inversion" },
};

/** "Backwards (1st inversion)", or just "Root position". */
export function inversionLabel(inv: Inversion): string {
  const l = INVERSION_LABELS[inv];
  return inv === 0 ? l.standard : `${l.pfa} (${l.standard})`;
}
