// Curriculum content: which chords and progressions exist, in what order they
// are introduced, and how they're described. Everything here is key-agnostic;
// generate.ts expands it across all 12 keys.

import { QUALITIES as Q, type Quality } from "../theory/shapes";

// Chord roots as they're conventionally named (F# rather than Gb, Bb rather than A#).
export const MAJOR_KEYS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const MINOR_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

// Order keys are introduced in: familiar keys first, most black keys last.
export const MAJOR_KEY_ORDER = ["C", "G", "F", "D", "Bb", "A", "Eb", "E", "Ab", "B", "Db", "F#"];
export const MINOR_KEY_ORDER = ["A", "E", "D", "B", "G", "C", "F#", "F", "C#", "Bb", "G#", "Eb"];

// Rhythm modifiers, picked at random each time a progression card is shown.
const POP_STYLES = [
  "Straight 4/4: one chord per bar, four beats each",
  "Half-beat bounce",
  "Oom-pah: bass on 1 & 3, chord on 2 & 4",
  "Arpeggiated: break each chord up, low to high",
  "Ballad: whole notes, let each chord ring",
];
const BLUES_STYLES = [
  "Shuffle: swung eighths",
  "Straight 4/4 rock",
  "Half-beat bounce",
  "Oom-pah stride",
];
const BALLAD_STYLES = [
  "Ballad: whole notes, let each chord ring",
  "Arpeggiated: break each chord up, low to high",
  "Straight 4/4: one chord per bar",
  "Slow 6/8: arpeggiate in threes",
];

// ── Tier 1: chord shapes ──────────────────────────────────────────────────

export interface ChordTypeDef {
  quality: Quality;
  roots: string[];
  level: number;
}

export const CHORD_TYPES: ChordTypeDef[] = [
  { quality: Q.maj, roots: MAJOR_KEYS, level: 1 },
  { quality: Q.min, roots: MINOR_KEYS, level: 1 },
  { quality: Q.dom7, roots: MAJOR_KEYS, level: 4 },
  { quality: Q.maj7, roots: MAJOR_KEYS, level: 4 },
  { quality: Q.min7, roots: MINOR_KEYS, level: 4 },
  { quality: Q.maj6, roots: MAJOR_KEYS, level: 7 },
  { quality: Q.min6, roots: MINOR_KEYS, level: 7 },
  { quality: Q.dim, roots: MINOR_KEYS, level: 7 },
  { quality: Q.aug, roots: MAJOR_KEYS, level: 7 },
];

// ── Tiers 2 & 3: progressions ─────────────────────────────────────────────

/** A chord inside a progression, by scale degree (1–7) of the key. */
export interface StepDef {
  degree: number;
  quality: Quality;
  roman: string;
  bassDegree?: number;     // slash chord: bass note (left hand) by scale degree
}

export interface ProgressionDef {
  id: string;
  name: string;
  tier: 2 | 3;
  category: string;
  categoryId: string;
  level: number;
  mode: "major" | "minor";
  steps: StepDef[];
  form?: number[];         // indexes into `steps`, bar by bar
  parallel?: boolean;      // keep one hand shape throughout (see voiceLead)
  styles: string[];
  hint: string;
}

const step = (quality: Quality, roman: string, degree: number, bassDegree?: number): StepDef => ({ degree, quality, roman, bassDegree });

export const PROGRESSIONS: ProgressionDef[] = [
  // Tier 2 ─ Core progressions
  {
    id: "backbone", name: "3-Chord Backbone", tier: 2, level: 2,
    category: "3-Chord Backbone", categoryId: "backbone", mode: "major",
    steps: [step(Q.maj, "I", 1), step(Q.maj, "IV", 4), step(Q.maj, "V", 5), step(Q.maj, "I", 1)],
    styles: POP_STYLES,
    hint: "I → IV and V → I each keep one note under the same finger. IV → V has no common note, so every finger steps down together. No jumps.",
  },
  {
    id: "doowop", name: "50s Doo-Wop", tier: 2, level: 3,
    category: "50s Doo-Wop", categoryId: "doowop", mode: "major",
    steps: [step(Q.maj, "I", 1), step(Q.min, "vi", 6), step(Q.maj, "IV", 4), step(Q.maj, "V", 5), step(Q.maj, "I", 1)],
    styles: POP_STYLES,
    hint: "I → vi and vi → IV each share two notes, so only one finger moves. IV → V is the one change where every finger steps.",
  },
  {
    id: "blues", name: "12-Bar Blues", tier: 2, level: 5,
    category: "12-Bar Blues", categoryId: "blues", mode: "major",
    steps: [step(Q.dom7, "I7", 1), step(Q.dom7, "IV7", 4), step(Q.dom7, "I7", 1), step(Q.dom7, "V7", 5), step(Q.dom7, "IV7", 4), step(Q.dom7, "I7", 1)],
    form: [0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 3],
    styles: BLUES_STYLES,
    hint: "7th shapes: take the triad and drop the root a whole step (the left hand keeps the root). These shapes share no notes, but every finger moves by only a half or whole step.",
  },

  // Tier 3 ─ Advanced & ballad progressions
  {
    id: "iivi", name: "Jazz Turnaround", tier: 3, level: 5,
    category: "Jazz Turnarounds", categoryId: "iivi", mode: "major",
    steps: [step(Q.min7, "ii7", 2), step(Q.dom7, "V7", 5), step(Q.maj7, "Imaj7", 1)],
    styles: POP_STYLES,
    hint: "Each change keeps one note and moves the other two by a step. Your hand barely travels.",
  },
  {
    id: "majwalk", name: "Major Walkdown", tier: 3, level: 6,
    category: "Chromatic Walkdowns", categoryId: "walkdowns", mode: "major",
    steps: [step(Q.maj, "I", 1), step(Q.maj7, "Imaj7", 1), step(Q.dom7, "I7", 1), step(Q.maj, "IV", 4)],
    styles: BALLAD_STYLES,
    hint: "Hold two notes. One finger walks down chromatically: root → maj7 → b7, then resolve to IV.",
  },
  {
    id: "minwalk", name: "Minor Walkdown (James Bond)", tier: 3, level: 6,
    category: "Chromatic Walkdowns", categoryId: "walkdowns", mode: "minor",
    steps: [step(Q.min, "i", 1), step(Q.minMaj7, "i(maj7)", 1), step(Q.min7, "i7", 1), step(Q.min6Walk, "i6", 1)],
    styles: BALLAD_STYLES,
    hint: "Hold the minor 3rd and 5th. One finger walks down a half step at a time: root → maj7 → b7 → 6.",
  },
  {
    id: "walkup", name: "R&B Walk-up", tier: 3, level: 8,
    category: "R&B Walk-ups", categoryId: "walkup", mode: "major",
    steps: [step(Q.maj, "I", 1), step(Q.min, "ii", 2), step(Q.min, "iii", 3), step(Q.maj, "IV", 4)],
    parallel: true,
    styles: POP_STYLES,
    hint: "Keep the same hand shape and slide it up the scale, one step per chord. The shape stays locked; only its position changes.",
  },
  {
    id: "basswalk", name: "Ballad Bass Walkdown", tier: 3, level: 8,
    category: "Ballad Slash Chords", categoryId: "ballad", mode: "major",
    steps: [step(Q.maj, "I", 1), step(Q.maj, "V/7", 5, 7), step(Q.min, "vi", 6), step(Q.maj, "IV", 4)],
    styles: BALLAD_STYLES,
    hint: "Left hand walks the bass down the scale (1 → 7 → 6 → 4). Right hand moves as little as possible and holds common notes where they exist.",
  },
  {
    id: "pedal", name: "Pedal Point", tier: 3, level: 8,
    category: "Ballad Slash Chords", categoryId: "ballad", mode: "major",
    steps: [step(Q.maj, "I", 1), step(Q.maj, "IV/1", 4, 1), step(Q.maj, "I", 1)],
    styles: BALLAD_STYLES,
    hint: "Left hand holds the tonic the whole time. Right hand keeps the root and moves two fingers up and back.",
  },
];
