// Expand the curriculum definitions into concrete cards for all 12 keys.

import { Key } from "tonal";
import type { Card, ChordCard, Deck, Inversion, ProgressionCard } from "../types";
import { homeVoicing, motion, voiceLead, chordSymbol, type ChordSpec } from "../theory/voicing";
import {
  CHORD_TYPES, MAJOR_KEYS, MAJOR_KEY_ORDER, MINOR_KEYS, MINOR_KEY_ORDER, PROGRESSIONS,
  type ProgressionDef,
} from "./definitions";

const INVERSION_SLUGS = ["root", "bwd", "mid"] as const;
const INVERSIONS: Inversion[] = [0, 1, 2];

/** "F#" -> "fs", "Bb" -> "bb" for stable ids. */
const slug = (note: string) => note.toLowerCase().replace("#", "s");

export function chordCards(): ChordCard[] {
  const cards: ChordCard[] = [];
  CHORD_TYPES.forEach((type, typeIndex) => {
    for (const root of type.roots) {
      const spec: ChordSpec = { root, quality: type.quality };
      const order = type.roots === MINOR_KEYS ? MINOR_KEY_ORDER : MAJOR_KEY_ORDER;
      for (const inv of INVERSIONS) {
        const id = `t1_${slug(root)}_${type.quality.id}_${INVERSION_SLUGS[inv]}`;
        cards.push({
          kind: "chord",
          id,
          tier: 1,
          category: "Chord Shapes",
          categoryId: "chords",
          level: chordLevel(type.quality.id, root, inv),
          sequence: order.indexOf(root) * 100 + typeIndex,
          sibling: `chord_${slug(root)}_${type.quality.id}`,
          targetInversion: inv,
          symbol: chordSymbol(spec),
          quality: type.quality.name,
          shapeRule: type.quality.rule,
          hint: type.quality.swap ? `${type.quality.rule}. The left hand plays the root, ${root}.` : type.quality.rule,
          inversions: INVERSIONS.map((inv) => homeVoicing(spec, inv)),
        });
      }
    }
  });
  return cards;
}


function chordLevel(quality: string, root: string, inv: Inversion): number {
  const familiar = ["C", "G", "F", "D", "A", "E"].includes(root);
  if (quality === "maj" || quality === "min") {
    if (inv) return (inv === 1 ? 9 : 11) + (familiar ? 0 : 1);
    if (quality === "min") return familiar ? 6 : 8;
    if (["C", "G", "F"].includes(root)) return 1;
    if (["D", "A", "E"].includes(root)) return 3;
    return ["B", "Bb"].includes(root) ? 4 : 5;
  }
  return (["7", "maj7", "m7"].includes(quality) ? 14 : 18) + inv;
}

/** Root note of scale degree `degree` (1–7) in `key`. */
function degreeRoot(key: string, mode: "major" | "minor", degree: number): string {
  const scale = mode === "major" ? Key.majorKey(key).scale : Key.minorKey(key).natural.scale;
  return scale[degree - 1]!;
}

export function progressionCards(def: ProgressionDef, progIndex: number): ProgressionCard[] {
  const keys = def.mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
  const order = def.mode === "major" ? MAJOR_KEY_ORDER : MINOR_KEY_ORDER;
  const cards: ProgressionCard[] = [];

  for (const key of keys) {
    const specs: ChordSpec[] = def.steps.map((s) => ({
      root: degreeRoot(key, def.mode, s.degree),
      quality: s.quality,
      bass: s.bassDegree ? degreeRoot(key, def.mode, s.bassDegree) : undefined,
    }));
    const symbols = specs.map(chordSymbol);
    const keyName = def.mode === "major" ? key : `${key}m`;

    for (const inv of INVERSIONS) {
      const steps = voiceLead(specs, inv, def.parallel);
      cards.push({
        kind: "progression",
        id: `t${def.tier}_${def.id}_${slug(keyName)}_${INVERSION_SLUGS[inv]}`,
        tier: def.tier,
        category: def.category,
        categoryId: def.categoryId,
        level: ["backbone", "doowop"].includes(def.id) ? 13 : ["blues", "iivi"].includes(def.id) ? 17 : 21,
        // Introduce every key from Root first, then Backwards, then Middle.
        sequence: inv * 10000 + order.indexOf(key) * 100 + progIndex,
        sibling: `${def.id}_${slug(keyName)}`,
        hint: def.hint,
        name: def.name,
        key: keyName,
        roman: def.steps.map((s) => s.roman),
        symbols,
        form: def.form?.map((i) => symbols[i]!),
        startInversion: inv,
        steps,
        motions: steps.slice(1).map((v, i) => motion(steps[i]!, v)),
        styles: def.styles,
      });
    }
  }
  return cards;
}

function guidedCards(): ProgressionCard[] {
  return PROGRESSIONS.filter((d) => ["backbone", "doowop"].includes(d.id)).flatMap((def, index) =>
    progressionCards(def, index).filter((c) => c.startInversion === 0).map((card) => {
      const familiar = card.name === "3-Chord Backbone" && card.key === "C";
      const specs = def.steps.map((step) => ({ root: degreeRoot(card.key, def.mode, step.degree), quality: step.quality }));
      const steps = specs.map((spec) => homeVoicing(spec, 0));
      return { ...card, id: `guided_${card.id}`, sibling: `guided_${card.sibling}`, guided: true,
        level: familiar ? 2 : 7, steps, motions: steps.slice(1).map((v, i) => motion(steps[i]!, v)),
        styles: familiar ? [card.styles[0]!] : card.styles,
        hint: "Keep the diagrams visible and practice the rhythm slowly. Use root positions; keep time before increasing speed." };
    }).filter((card) => card.level === 2 || ["C", "F"].includes(card.key)));
}

export function generateDeck(): Deck {
  const cards: Card[] = [...chordCards(), ...guidedCards(), ...PROGRESSIONS.flatMap(progressionCards)];
  return {
    name: "Piano For All: Chords & Progressions",
    version: "2",
    generated: new Date().toISOString(),
    cards,
  };
}
