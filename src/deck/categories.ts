// Category filters shown in Settings. Kept separate from definitions.ts so the
// browser bundle doesn't pull in the music-theory library.

export const CATEGORY_FILTERS: { id: string; label: string; tier: number }[] = [
  { id: "chords", label: "Chord shapes", tier: 1 },
  { id: "backbone", label: "3-Chord Backbone", tier: 2 },
  { id: "doowop", label: "50s Doo-Wop", tier: 2 },
  { id: "blues", label: "12-Bar Blues", tier: 2 },
  { id: "iivi", label: "Jazz Turnarounds", tier: 3 },
  { id: "walkdowns", label: "Chromatic Walkdowns", tier: 3 },
  { id: "walkup", label: "R&B Walk-ups", tier: 3 },
  { id: "ballad", label: "Ballad Slash Chords", tier: 3 },
];
