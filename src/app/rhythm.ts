// Concrete practice examples for broad rhythm labels, not course transcriptions.
export interface RhythmEvent { at: number; length: number; notes: number[]; hand: "bass" | "chord"; }
export interface Rhythm { beats: number; count: string[]; cells: string[]; description: string; events: RhythmEvent[]; }
const chord = [60, 64, 67];
export function rhythmFor(style: string): Rhythm {
  const events: RhythmEvent[] = [];
  const add = (at: number, length: number, notes = chord, hand: "bass" | "chord" = "chord") => events.push({ at, length, notes, hand });
  const eighths = ["1", "&", "2", "&", "3", "&", "4", "&"];
  if (style.startsWith("Slow 6/8")) {
    for (let i = 0; i < 6; i++) add(i, .85, [chord[i % 3]!]);
    return { beats: 6, count: ["1", "2", "3", "4", "5", "6"], cells: ["Low", "Middle", "High", "Low", "Middle", "High"], description: "Two groups of three: ONE two three FOUR five six. One chord tone per eighth-note pulse; tempo counts those pulses.", events };
  }
  if (style.startsWith("Oom-pah")) {
    for (let i = 0; i < 4; i++) add(i, .7, i % 2 ? chord : [48], i % 2 ? "chord" : "bass");
    return { beats: 4, count: ["1", "2", "3", "4"], cells: ["Bass", "Chord", "Bass", "Chord"], description: "Left hand: bass on 1 and 3. Right hand: chord on 2 and 4. Say oom–pah–oom–pah.", events };
  }
  if (style.startsWith("Shuffle")) {
    for (let i = 0; i < 4; i++) { add(i, .5); add(i + 2 / 3, .22); }
    return { beats: 4, count: ["1", "a", "2", "a", "3", "a", "4", "a"], cells: Array(8).fill("Chord"), description: "Long–short pairs. Count each beat as a triplet and play its first and third parts: ONE (and) a.", events };
  }
  if (style.startsWith("Half-beat")) {
    for (let i = 0; i < 8; i++) add(i / 2, .32, i % 2 ? chord : [48], i % 2 ? "chord" : "bass");
    return { beats: 4, count: eighths, cells: Array.from({ length: 8 }, (_, i) => i % 2 ? "Chord" : "Bass"), description: "Example bounce: bass on each numbered beat, chord on each &. Keep all eight pulses evenly spaced.", events };
  }
  if (style.startsWith("Arpeggiated")) {
    const order = [0, 1, 2, 1, 0, 1, 2, 1];
    order.forEach((note, i) => add(i / 2, .42, [chord[note]!]));
    return { beats: 4, count: eighths, cells: order.map((i) => ["Low", "Middle", "High"][i]!), description: "Example broken chord: low–middle–high–middle, twice per bar. Play one note on every beat and &.", events };
  }
  if (style.startsWith("Straight 4/4 rock")) {
    for (let i = 0; i < 4; i++) add(i, .7);
    return { beats: 4, count: ["1", "2", "3", "4"], cells: Array(4).fill("Chord"), description: "Strike the chord on each numbered beat, evenly: ONE TWO THREE FOUR.", events };
  }
  add(0, 3.8);
  return { beats: 4, count: ["1", "2", "3", "4"], cells: ["Chord", "Hold", "Hold", "Hold"], description: "Strike the chord on 1 and let it ring through 2, 3 and 4. Change chords at the next bar.", events };
}

export class RhythmPlayer {
  private context?: AudioContext;
  private voices: OscillatorNode[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private generation = 0;
  stop() {
    this.generation++;
    this.timers.forEach(clearTimeout); this.timers = [];
    this.voices.forEach((voice) => { try { voice.stop(); } catch {} }); this.voices = [];
  }
  async play(rhythm: Rhythm, bpm: number, highlight: (index: number) => void, done: () => void) {
    this.stop();
    const generation = this.generation;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (generation !== this.generation) return;
    const context = this.context;
    const pulse = 60 / Math.max(40, Math.min(140, bpm));
    const start = context.currentTime + .1;
    const tone = (midi: number, at: number, length: number, volume: number) => {
      const osc = context.createOscillator(); const gain = context.createGain();
      osc.type = "triangle"; osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.001, at + length);
      osc.connect(gain); gain.connect(context.destination); osc.start(at); osc.stop(at + length + .02);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      this.voices.push(osc);
    };
    // One bar of count-in clicks, then two bars of the same rhythm in C.
    for (let i = 0; i < rhythm.beats * 3; i++) tone(i % rhythm.beats ? 84 : 91, start + i * pulse, .045, .025);
    for (let bar = 1; bar <= 2; bar++) for (const event of rhythm.events) {
      const at = start + (bar * rhythm.beats + event.at) * pulse;
      event.notes.forEach((midi) => tone(midi, at, event.length * pulse, event.hand === "bass" ? .12 : .065));

    }
    for (let bar = 1; bar <= 2; bar++) rhythm.count.forEach((_, index) => {
      const offset = rhythm.count.length === rhythm.beats ? index
        : rhythm.description.startsWith("Long–short") ? Math.floor(index / 2) + (index % 2 ? 2 / 3 : 0) : index / 2;
      const at = start + (bar * rhythm.beats + offset) * pulse;
      this.timers.push(setTimeout(() => highlight(index), (at - context.currentTime) * 1000));
    });
    this.timers.push(setTimeout(() => { this.stop(); done(); }, (start + rhythm.beats * 3 * pulse - context.currentTime) * 1000));
  }
}
