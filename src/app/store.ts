// Persistence: everything the app learns about you lives in this browser's
// localStorage (on the iPad). Export/import is the only backup, so the format
// is plain JSON and versioned.

import type { Card as FsrsCard } from "ts-fsrs";

export type PromptStyle = "symbols" | "roman" | "both";

export interface Settings {
  newPerDay: number;
  promptStyle: PromptStyle;
  categories: Record<string, boolean>;   // categoryId -> enabled (missing = enabled)
}

/** FSRS card state with dates as ISO strings. */
export type SavedCard = Omit<FsrsCard, "due" | "last_review"> & { due: string; last_review?: string };

export interface ReviewEntry {
  id: string;
  at: string;          // ISO time
  rating: number;      // 1 Again · 2 Hard · 3 Good · 4 Easy
  asked: string;       // what the randomised front asked for, e.g. "Middle" or a rhythm style
  ms: number;          // time from card shown to answer revealed
}

export interface SaveData {
  schema: 1;
  settings: Settings;
  cards: Record<string, SavedCard>;
  log: ReviewEntry[];
  today: { day: string; newIds: string[] };
}

const KEY = "chord-practice:v2";

export function defaultSettings(): Settings {
  return { newPerDay: 10, promptStyle: "both", categories: {} };
}

export function emptyData(): SaveData {
  return { schema: 1, settings: defaultSettings(), cards: {}, log: [], today: { day: studyDay(), newIds: [] } };
}

/** Study days roll over at 4am, like Anki, so a late session counts as "today". */
export function studyDay(now = new Date()): string {
  const d = new Date(now.getTime() - 4 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Start of the next study day (4am local). */
export function nextDayStart(now = new Date()): Date {
  const d = new Date(now.getTime() - 4 * 3600_000);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return new Date(d.getTime() + 4 * 3600_000);
}

function validate(data: unknown): SaveData {
  const d = data as Partial<SaveData>;
  if (!d || d.schema !== 1 || typeof d.cards !== "object" || !Array.isArray(d.log)) {
    throw new Error("This doesn't look like a Chord Practice backup.");
  }
  return {
    ...emptyData(),
    ...d,
    settings: { ...defaultSettings(), ...d.settings },
  } as SaveData;
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? validate(JSON.parse(raw)) : emptyData();
    if (data.today.day !== studyDay()) data.today = { day: studyDay(), newIds: [] };
    return data;
  } catch {
    return emptyData();
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Could not save progress", e);
  }
}

export function toFsrs(c: SavedCard): FsrsCard {
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined };
}

export function fromFsrs(c: FsrsCard): SavedCard {
  return { ...c, due: c.due.toISOString(), last_review: c.last_review?.toISOString() };
}

export function exportBackup(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `chord-practice-backup-${studyDay()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function importBackup(file: File): Promise<SaveData> {
  return validate(JSON.parse(await file.text()));
}

/** Ask the browser not to evict our data. Best-effort; iPad browsers honour Home Screen installs most. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
