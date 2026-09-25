// Piano For All-style keyboard diagram: a stretch of keys with red dots on the
// notes to play. Rendered as an SVG string so it stays crisp on the iPad.

const WHITE_W = 24;
const WHITE_H = 104;
const BLACK_W = 14;
const BLACK_H = 64;
const LABEL_H = 22;

// Position of each pitch class: white-key index within the octave, and for
// black keys a nudge off the boundary (as on a real keyboard).
const LAYOUT: Record<number, { white: number; black?: number }> = {
  0: { white: 0 }, 1: { white: 1, black: -0.15 }, 2: { white: 1 }, 3: { white: 2, black: 0.15 },
  4: { white: 2 }, 5: { white: 3 }, 6: { white: 4, black: -0.2 }, 7: { white: 4 },
  8: { white: 5, black: 0 }, 9: { white: 5 }, 10: { white: 6, black: 0.2 }, 11: { white: 6 },
};

const isBlack = (midi: number) => LAYOUT[midi % 12]!.black !== undefined;

export interface Dot {
  midi: number;
  label: string;
  held?: boolean;      // same key was down in the previous chord
}

const WHITE_KEYS_MIN = 15;   // a little over two octaves

const whiteCount = (lo: number, hi: number) => {
  let n = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++;
  return n;
};

/**
 * Keyboard range covering every note with some margin: starts on a C or F and
 * ends on an E or B (so no black key is cut in half), about two octaves wide.
 */
export function rangeFor(allMidi: number[]): { lo: number; hi: number } {
  let lo = Math.min(...allMidi) - 2;
  let hi = Math.max(...allMidi) + 2;
  const startsGroup = (m: number) => m % 12 === 0 || m % 12 === 5;   // C or F
  const endsGroup = (m: number) => m % 12 === 4 || m % 12 === 11;    // E or B
  while (!startsGroup(lo)) lo--;
  while (!endsGroup(hi)) hi++;
  while (whiteCount(lo, hi) < WHITE_KEYS_MIN) {
    // Grow on whichever side has less margin, one key group at a time.
    if (Math.min(...allMidi) - lo <= hi - Math.max(...allMidi)) do lo--; while (!startsGroup(lo));
    else do hi++; while (!endsGroup(hi));
  }
  return { lo, hi };
}

function whiteX(midi: number, lo: number): number {
  const octaves = Math.floor(midi / 12) - Math.floor(lo / 12);
  return (octaves * 7 + LAYOUT[midi % 12]!.white - LAYOUT[lo % 12]!.white) * WHITE_W;
}

function keyCentre(midi: number, lo: number): number {
  const layout = LAYOUT[midi % 12]!;
  const x = whiteX(midi, lo);
  return layout.black === undefined ? x + WHITE_W / 2 : x + layout.black * BLACK_W;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function keyboardSvg(dots: Dot[], range: { lo: number; hi: number }, title: string): string {
  const { lo, hi } = range;
  const width = whiteX(hi, lo) + WHITE_W;
  const parts: string[] = [];

  for (let m = lo; m <= hi; m++) {
    if (!isBlack(m)) parts.push(`<rect class="kw" x="${whiteX(m, lo)}" y="0" width="${WHITE_W}" height="${WHITE_H}" rx="2"/>`);
  }
  for (let m = lo; m <= hi; m++) {
    if (isBlack(m)) parts.push(`<rect class="kb" x="${keyCentre(m, lo) - BLACK_W / 2}" y="0" width="${BLACK_W}" height="${BLACK_H}" rx="1.5"/>`);
  }

  for (const d of dots) {
    const cx = keyCentre(d.midi, lo);
    const cy = isBlack(d.midi) ? BLACK_H - 13 : WHITE_H - 15;
    if (d.held) parts.push(`<circle class="held${isBlack(d.midi) ? " on-black" : ""}" cx="${cx}" cy="${cy}" r="10.5"/>`);
    parts.push(`<circle class="dot" cx="${cx}" cy="${cy}" r="7.5"/>`);
    parts.push(`<text class="note" x="${cx}" y="${WHITE_H + 16}">${escape(d.label)}</text>`);
  }

  return `<svg class="keyboard" viewBox="-1 -1 ${width + 2} ${WHITE_H + LABEL_H + 2}" role="img" aria-label="${escape(title)}">${parts.join("")}</svg>`;
}
