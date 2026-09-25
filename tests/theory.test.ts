import { describe, expect, test } from "bun:test";
import { Chord, Note } from "tonal";
import { QUALITIES as Q } from "../src/theory/shapes";
import { homeVoicing, voiceLead, motion, type ChordSpec } from "../src/theory/voicing";

const names = (v: { names: string[] }) => v.names.join(" ");
const chroma = (n: string) => Note.chroma(n);

describe("PfA chord shapes", () => {
  test.each([
    ["C", "maj", "C E G", "E G C", "G C E"],
    ["C", "min", "C Eb G", "Eb G C", "G C Eb"],
    ["C", "dom7", "Bb E G", "E G Bb", "G Bb E"],
    ["C", "maj7", "B E G", "E G B", "G B E"],
    ["C", "min7", "Bb Eb G", "Eb G Bb", "G Bb Eb"],
    ["C", "maj6", "C E A", "E A C", "A C E"],
    ["C", "min6", "C Eb A", "Eb A C", "A C Eb"],
    ["C", "dim", "C Eb Gb", "Eb Gb C", "Gb C Eb"],
    ["C", "aug", "C E G#", "E G# C", "G# C E"],
  ])("%s %s: root / backwards / middle", (root, key, r, b, m) => {
    const spec = { root, quality: Q[key as keyof typeof Q] };
    expect(names(homeVoicing(spec, 0))).toBe(r);
    expect(names(homeVoicing(spec, 1))).toBe(b);
    expect(names(homeVoicing(spec, 2))).toBe(m);
  });

  test("Backwards puts the root on top (pinky), Middle puts it in the middle", () => {
    for (const root of ["C", "F#", "Bb", "E"]) {
      const spec = { root, quality: Q.maj };
      expect(chroma(homeVoicing(spec, 1).names[2]!)).toBe(chroma(root));
      expect(chroma(homeVoicing(spec, 2).names[1]!)).toBe(chroma(root));
    }
  });

  const tonalSymbol: Record<string, string> = {
    maj: "M", min: "m", "7": "7", maj7: "maj7", m7: "m7", mmaj7: "mMaj7", "6": "6", m6: "m6", dim: "dim", aug: "aug",
  };
  const roots = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "G#", "Ab", "A", "Bb", "B"];

  test("every shape uses only real chord tones, ascending, 3 distinct keys, in range", () => {
    for (const quality of Object.values(Q)) {
      for (const root of roots) {
        const full = Chord.get(`${root}${tonalSymbol[quality.id]}`).notes.map(chroma);
        expect(full.length).toBeGreaterThanOrEqual(3);
        for (const inv of [0, 1, 2] as const) {
          const v = homeVoicing({ root, quality }, inv);
          expect(v.midi).toHaveLength(3);
          expect([...v.midi].sort((a, b) => a - b)).toEqual(v.midi);
          expect(new Set(v.midi).size).toBe(3);
          for (const n of v.names) expect(full).toContain(chroma(n));
          v.midi.forEach((m, i) => expect(m % 12).toBe(chroma(v.names[i]!)));
          expect(v.midi[0]).toBeGreaterThanOrEqual(52);
          expect(v.midi[2]).toBeLessThanOrEqual(81);
        }
      }
    }
  });
});

describe("voice leading", () => {
  const C = (root: string, quality = Q.maj): ChordSpec => ({ root, quality });

  test("I–IV–V–I in C from root position is the textbook path", () => {
    const path = voiceLead([C("C"), C("F"), C("G"), C("C")], 0);
    expect(path.map(names)).toEqual(["C E G", "C F A", "B D G", "C E G"]);
    expect(path.map((v) => v.inversion)).toEqual([0, 2, 1, 0]);
  });

  test("ii–V–I in C holds a common tone on each change", () => {
    const path = voiceLead([C("D", Q.min7), C("G", Q.dom7), C("C", Q.maj7)], 0);
    expect(path.map(names)).toEqual(["C F A", "D F B", "E G B"]);
    expect(motion(path[0]!, path[1]!).held).toEqual(["F"]);
    expect(motion(path[1]!, path[2]!).held).toEqual(["B"]);
  });

  test("James Bond walkdown holds two notes while one walks down", () => {
    const path = voiceLead([C("A", Q.min), C("A", Q.minMaj7), C("A", Q.min7), C("A", Q.min6Walk)], 0);
    expect(path.map(names)).toEqual(["A C E", "G# C E", "G C E", "F# C E"]);
    for (let i = 1; i < path.length; i++) expect(motion(path[i - 1]!, path[i]!).held).toEqual(["C", "E"]);
  });

  test("parallel walk-up keeps one hand shape", () => {
    const path = voiceLead([C("C"), C("D", Q.min), C("E", Q.min), C("F")], 1, true);
    expect(path.map(names)).toEqual(["E G C", "F A D", "G B E", "A C F"]);
  });

  test("progression ends where it started when it returns to I", () => {
    for (const inv of [0, 1, 2] as const) {
      const path = voiceLead([C("G"), C("C"), C("D"), C("G")], inv);
      expect(path[3]!.midi).toEqual(path[0]!.midi);
    }
  });
});
