// Piano For All right-hand chord shapes.
//
// Every chord is a 3-note shape: a triad, optionally with one note swapped for
// a nearby note (the left hand supplies the root). For example C7 is the C major
// triad with the root dropped a whole step (C E G -> Bb E G). Because the swap
// happens "in place", each shape has the same three inversions as its triad.

import { Note } from "tonal";

export interface Quality {
  id: string;             // stable slug used in card ids
  suffix: string;         // chord-symbol suffix: "", "m", "7", "m(maj7)", ...
  name: string;           // "Minor 7th"
  triad: [string, string, string];     // intervals of the base triad, root first
  swap?: { index: 0 | 2; interval: string; semitones: number };
  rule: string;           // how to build it, in Piano For All terms
}

const MAJOR: [string, string, string] = ["1P", "3M", "5P"];
const MINOR: [string, string, string] = ["1P", "3m", "5P"];

export const QUALITIES = {
  maj: { id: "maj", suffix: "", name: "Major", triad: MAJOR, rule: "Major triad" },
  min: { id: "min", suffix: "m", name: "Minor", triad: MINOR, rule: "Minor triad: major with the middle note down a half step" },
  dom7: {
    id: "7", suffix: "7", name: "Dominant 7th", triad: MAJOR,
    swap: { index: 0, interval: "7m", semitones: -2 },
    rule: "Major triad, drop the root a whole step",
  },
  maj7: {
    id: "maj7", suffix: "maj7", name: "Major 7th", triad: MAJOR,
    swap: { index: 0, interval: "7M", semitones: -1 },
    rule: "Major triad, drop the root a half step",
  },
  min7: {
    id: "m7", suffix: "m7", name: "Minor 7th", triad: MINOR,
    swap: { index: 0, interval: "7m", semitones: -2 },
    rule: "Minor triad, drop the root a whole step",
  },
  minMaj7: {
    id: "mmaj7", suffix: "m(maj7)", name: "Minor major 7th", triad: MINOR,
    swap: { index: 0, interval: "7M", semitones: -1 },
    rule: "Minor triad, drop the root a half step",
  },
  maj6: {
    id: "6", suffix: "6", name: "Major 6th", triad: MAJOR,
    swap: { index: 2, interval: "6M", semitones: 2 },
    rule: "Major triad, raise the 5th a whole step",
  },
  min6: {
    id: "m6", suffix: "m6", name: "Minor 6th", triad: MINOR,
    swap: { index: 2, interval: "6M", semitones: 2 },
    rule: "Minor triad, raise the 5th a whole step",
  },
  // Same chord as min6, but shaped so a walkdown line keeps descending
  // (Am7 G-C-E -> Am6 F#-C-E). Only used inside the minor walkdown.
  min6Walk: {
    id: "m6", suffix: "m6", name: "Minor 6th", triad: MINOR,
    swap: { index: 0, interval: "6M", semitones: -3 },
    rule: "Minor triad, drop the root a minor 3rd (continues the walkdown line)",
  },
  dim: { id: "dim", suffix: "dim", name: "Diminished", triad: ["1P", "3m", "5d"], rule: "Minor triad, flatten the 5th" },
  aug: { id: "aug", suffix: "aug", name: "Augmented", triad: ["1P", "3M", "5A"], rule: "Major triad, sharpen the 5th" },
} satisfies Record<string, Quality>;

/**
 * Display name for a note. Theory-correct spellings like E#, Cb or F## are
 * shown as the key you actually press (F, B, G), which reads faster at the piano.
 */
export function displayName(note: string): string {
  const pc = Note.pitchClass(note);
  if (/^[EB]#$|^[CF]b$|##|bb/.test(pc)) return Note.enharmonic(pc);
  return pc;
}

/**
 * Close-position voicing of `quality` on `root`, in the given inversion, with
 * the lowest note in octave 4 before any swap. Callers shift octaves as needed.
 */
export function shapeVoicing(root: string, quality: Quality, inversion: 0 | 1 | 2): { midi: number[]; names: string[] } {
  // Build the triad in close position, rotated to the inversion.
  const tones = quality.triad.map((iv) => Note.transpose(root, iv));
  const order = [0, 1, 2].map((i) => (i + inversion) % 3);
  const midi: number[] = [];
  const names: string[] = [];
  let prev = -Infinity;
  for (const idx of order) {
    let m = Note.midi(`${tones[idx]}4`)!;
    if (midi.length === 0) {
      prev = m;
    } else {
      while (m <= prev) m += 12;
      prev = m;
    }
    midi.push(m);
    names.push(tones[idx]!);
  }

  // Apply the PfA swap to whichever voice holds that triad note.
  if (quality.swap) {
    const pos = order.indexOf(quality.swap.index);
    midi[pos] = midi[pos]! + quality.swap.semitones;
    names[pos] = Note.transpose(root, quality.swap.interval);
  }

  return { midi, names: names.map(displayName) };
}
