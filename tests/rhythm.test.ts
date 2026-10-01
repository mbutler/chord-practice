import { expect, test } from "bun:test";
import { PROGRESSIONS } from "../src/deck/definitions";
import { rhythmFor } from "../src/app/rhythm";

test("every curriculum rhythm has a playable pattern and matching beat labels", () => {
  for (const style of new Set(PROGRESSIONS.flatMap((p) => p.styles))) {
    const rhythm = rhythmFor(style);
    expect(rhythm.count.length).toBe(rhythm.cells.length);
    expect(rhythm.events.length).toBeGreaterThan(0);
    for (const event of rhythm.events) {
      expect(event.at).toBeGreaterThanOrEqual(0);
      expect(event.at + event.length).toBeLessThanOrEqual(rhythm.beats);
      expect(event.notes.length).toBeGreaterThan(0);
    }
  }
});
test("oom-pah alternates hands on numbered beats", () => {
  const rhythm = rhythmFor("Oom-pah stride");
  expect(rhythm.events.map((e) => e.at)).toEqual([0, 1, 2, 3]);
  expect(rhythm.events.map((e) => e.hand)).toEqual(["bass", "chord", "bass", "chord"]);
});
test("shuffle has long-short triplet timing rather than straight eighths", () => {
  expect(rhythmFor("Shuffle: swung eighths").events.map((e) => e.at)).toEqual([0, 2/3, 1, 1+2/3, 2, 2+2/3, 3, 3+2/3]);
});
test("ballad sustains; rock repeats; 6/8 groups six notes into two threes", () => {
  expect(rhythmFor("Ballad: whole notes, let each chord ring").events).toHaveLength(1);
  expect(rhythmFor("Straight 4/4 rock").events).toHaveLength(4);
  const six = rhythmFor("Slow 6/8: arpeggiate in threes");
  expect(six.beats).toBe(6);
  expect(six.events.map((e) => e.notes)).toEqual([[60], [64], [67], [60], [64], [67]]);
});
