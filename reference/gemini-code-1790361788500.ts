import { writeFileSync } from "fs";

const keys = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const cards = [];

keys.forEach(key => {
  // Tier 1: Fundamental Triads (Book 1 & 3)
  const triads = ["Major", "Minor"];
  triads.forEach(type => {
    cards.push({
      id: `t1_${key.toLowerCase()}_${type.toLowerCase()}`,
      tier: 1,
      category: "Fundamental Triads",
      prompt: `${key} ${type}`,
      hint: "Root position."
    });
  });
  
  // Tier 1: Advanced Chords (Book 4)
  const advancedTypes = [
    { name: "7", hint: "Drop root down a whole step" },
    { name: "maj7", hint: "Drop root down a half step" },
    { name: "m7", hint: "Minor triad, drop root down whole step" },
    { name: "6", hint: "Major triad, raise 5th a whole step" },
    { name: "dim", hint: "Minor triad, flat the 5th" },
    { name: "aug", hint: "Major triad, sharp the 5th" }
  ];
  
  advancedTypes.forEach(type => {
    cards.push({
      id: `t1_${key.toLowerCase()}_${type.name}`,
      tier: 1,
      category: "Advanced Chords",
      prompt: `${key}${type.name}`,
      hint: type.hint
    });
  });

  // Tier 2: Core Progressions (Book 1 & 2)
  cards.push({
    id: `t2_prog_145_${key.toLowerCase()}`,
    tier: 2,
    category: "Core Progressions",
    prompt: `I - IV - V (Key of ${key})`,
    hint: "Use inversions to minimize hand movement."
  });

  // Tier 3: Walkdowns and Ballads (Book 5)
  cards.push({
    id: `t3_prog_ii_v_i_${key.toLowerCase()}`,
    tier: 3,
    category: "Jazz Turnarounds",
    prompt: `ii - V - I (Key of ${key})`,
    hint: "Transition smoothly between 7th chords."
  });
});

const deck = {
  deck_name: "Piano For All - Books 1-5 Complete",
  version: "1.0",
  total_cards: cards.length,
  cards: cards
};

writeFileSync("piano_deck.json", JSON.stringify(deck, null, 2));
console.log(`Successfully generated ${cards.length} cards.`);