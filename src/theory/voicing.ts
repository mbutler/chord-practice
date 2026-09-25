// Voice leading: choose the inversion and octave of each chord so the hand
// moves as little as possible, the way Piano For All teaches progressions.

import type { Inversion, Motion, Voicing } from "../types";
import { displayName, shapeVoicing, type Quality } from "./shapes";

export interface ChordSpec {
  root: string;
  quality: Quality;
  bass?: string;          // slash-chord bass (left hand); the right hand ignores it
}

export function chordSymbol(c: ChordSpec): string {
  return `${c.root}${c.quality.suffix}${c.bass ? `/${c.bass}` : ""}`;
}

// Keep voicings in a comfortable right-hand range around middle C.
const LOWEST = 52;   // E3
const HIGHEST = 81;  // A5
// Where a progression's first chord is centred (≈ E4, just above middle C).
const HOME_CENTRE = 64;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function shifted(base: { midi: number[]; names: string[] }, octaves: number) {
  return { midi: base.midi.map((m) => m + 12 * octaves), names: base.names };
}

/** Every inversion × octave of a chord that fits in the right-hand range. */
export function candidates(c: ChordSpec): Voicing[] {
  const out: Voicing[] = [];
  for (const inversion of [0, 1, 2] as Inversion[]) {
    const base = shapeVoicing(c.root, c.quality, inversion);
    for (let o = -3; o <= 3; o++) {
      const v = shifted(base, o);
      if (v.midi[0]! >= LOWEST && v.midi[v.midi.length - 1]! <= HIGHEST) {
        out.push({ symbol: chordSymbol(c), inversion, ...v });
      }
    }
  }
  return out;
}

/** The given inversion placed closest to the home position. */
export function homeVoicing(c: ChordSpec, inversion: Inversion): Voicing {
  const options = candidates(c).filter((v) => v.inversion === inversion);
  options.sort((a, b) => Math.abs(mean(a.midi) - HOME_CENTRE) - Math.abs(mean(b.midi) - HOME_CENTRE));
  return options[0]!;
}

/** Total semitones the fingers travel between two voicings (voices paired low→high). */
export function travel(a: Voicing, b: Voicing): number {
  return a.midi.reduce((sum, m, i) => sum + Math.abs(m - b.midi[i]!), 0);
}

// Small penalty for drifting away from where the progression started, so a
// long progression doesn't creep up or down the keyboard.
const DRIFT_WEIGHT = 0.25;

/**
 * Voice-lead a progression. The first chord is fixed at `startInversion` near
 * middle C; every later chord is chosen to minimise total finger travel over
 * the whole progression (dynamic programming, not greedy).
 *
 * With `parallel`, every chord keeps the starting inversion, so the same hand
 * shape slides along the keyboard (R&B/gospel walk-ups).
 */
export function voiceLead(chords: ChordSpec[], startInversion: Inversion, parallel = false): Voicing[] {
  const first = homeVoicing(chords[0]!, startInversion);
  const centre = mean(first.midi);
  const options = (c: ChordSpec) => candidates(c).filter((v) => !parallel || v.inversion === startInversion);
  const layers: Voicing[][] = [[first], ...chords.slice(1).map(options)];

  // best[i][j] = cheapest cost to reach layer i, candidate j; back[i][j] = predecessor index.
  const best: number[][] = [[0]];
  const back: number[][] = [[-1]];
  for (let i = 1; i < layers.length; i++) {
    best.push([]);
    back.push([]);
    for (const cand of layers[i]!) {
      let bestCost = Infinity;
      let bestPrev = -1;
      layers[i - 1]!.forEach((prev, p) => {
        const cost = best[i - 1]![p]! + travel(prev, cand) + DRIFT_WEIGHT * Math.abs(mean(cand.midi) - centre);
        if (cost < bestCost) {
          bestCost = cost;
          bestPrev = p;
        }
      });
      best[i]!.push(bestCost);
      back[i]!.push(bestPrev);
    }
  }

  const last = layers.length - 1;
  let j = best[last]!.indexOf(Math.min(...best[last]!));
  const path: Voicing[] = [];
  for (let i = last; i >= 0; i--) {
    path.unshift(layers[i]![j]!);
    j = back[i]![j]!;
  }
  return path;
}

/** Describe the move between two voicings: which notes hold, which fingers move. */
export function motion(a: Voicing, b: Voicing): Motion {
  const held = a.names.filter((_, i) => b.midi.includes(a.midi[i]!));
  const from = a.names.filter((_, i) => !b.midi.includes(a.midi[i]!));
  const to = b.names.filter((_, i) => !a.midi.includes(b.midi[i]!));
  return { held, moves: from.map((f, i) => ({ from: f, to: to[i]! })) };
}

export { displayName };
