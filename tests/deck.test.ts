import { describe, expect, test } from "bun:test";
import { generateDeck } from "../src/deck/generate";
import { travel } from "../src/theory/voicing";
import type { ProgressionCard } from "../src/types";

const deck = generateDeck();
const progressions = deck.cards.filter((c): c is ProgressionCard => c.kind === "progression");
const find = (id: string) => deck.cards.find((c) => c.id === id)!;

describe("deck", () => {
  test("card counts", () => {
    expect(deck.cards.filter((c) => c.tier === 1)).toHaveLength(9 * 12 * 3);
    expect(progressions).toHaveLength(9 * 12 * 3 + 4);
  });

  test("ids are unique", () => {
    expect(new Set(deck.cards.map((c) => c.id)).size).toBe(deck.cards.length);
  });

  test("ids are stable (progress is keyed on them)", () => {
    for (const id of ["t1_c_maj_root", "t1_fs_m7_bwd", "t1_bb_7_mid", "t2_backbone_c_root", "t3_iivi_bb_mid", "t3_minwalk_am_bwd"]) {
      expect(find(id)).toBeDefined();
    }
  });

  test("chord symbols are spelled conventionally per key", () => {
    expect((find("t2_backbone_fs_root") as ProgressionCard).symbols).toEqual(["F#", "B", "C#", "F#"]);
    expect((find("t2_doowop_db_root") as ProgressionCard).symbols).toEqual(["Db", "Bbm", "Gb", "Ab", "Db"]);
    expect((find("t3_iivi_eb_root") as ProgressionCard).symbols).toEqual(["Fm7", "Bb7", "Ebmaj7"]);
    expect((find("t3_basswalk_g_root") as ProgressionCard).symbols).toEqual(["G", "D/F#", "Em", "C"]);
    expect((find("t3_pedal_f_root") as ProgressionCard).symbols).toEqual(["F", "Bb/F", "F"]);
  });

  test("12-bar blues form", () => {
    const blues = find("t2_blues_c_root") as ProgressionCard;
    expect(blues.form).toEqual(["C7", "C7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"]);
  });

  test("each progression starts in its named inversion", () => {
    for (const p of progressions) expect(p.steps[0]!.inversion).toBe(p.startInversion);
  });

  test("no change needs a big hand jump", () => {
    // Worst-case total finger travel on any single change, in semitones.
    let worst = { amount: 0, where: "" };
    for (const p of progressions.filter((c) => !c.guided)) {
      p.steps.slice(1).forEach((v, i) => {
        const t = travel(p.steps[i]!, v);
        if (t > worst.amount) worst = { amount: t, where: `${p.id} step ${i + 1}` };
      });
    }
    expect(worst.amount, worst.where).toBeLessThanOrEqual(7);
  });
});
