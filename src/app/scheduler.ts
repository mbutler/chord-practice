// Study session: which card comes next, and what happens when you grade it.
// Scheduling itself is FSRS (the algorithm Anki uses); this file decides the
// daily mix of reviews, new cards and short-term relearning.

import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Grade } from "ts-fsrs";
import type { Card } from "../types";
import { fromFsrs, nextDayStart, save, toFsrs, type SaveData, type SavedCard } from "./store";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

// Show a learning card early rather than end the session while it waits.
const LEARN_AHEAD_MS = 20 * 60_000;
// Mix one new card in after every few reviews, rather than all at the end.
const REVIEWS_PER_NEW = 3;

export const GRADES: { rating: Grade; label: string; key: string }[] = [
  { rating: Rating.Again, label: "Again", key: "1" },
  { rating: Rating.Hard, label: "Hard", key: "2" },
  { rating: Rating.Good, label: "Good", key: "3" },
  { rating: Rating.Easy, label: "Easy", key: "4" },
];

export function isActive(card: Card, data: SaveData): boolean {
  return data.settings.categories[card.categoryId] !== false;
}

const byCurriculum = (a: Card, b: Card) => a.level - b.level || a.sequence - b.sequence;

/** New cards available today, in curriculum order, one per sibling group. */
export function newCardsToday(deck: Card[], data: SaveData): Card[] {
  const remaining = Math.max(0, data.settings.newPerDay - data.today.newIds.length);
  const introduced = new Set(data.today.newIds);
  const siblingsToday = new Set(deck.filter((c) => introduced.has(c.id)).map((c) => c.sibling));
  const out: Card[] = [];
  for (const card of deck.filter((c) => !data.cards[c.id] && isActive(c, data)).sort(byCurriculum)) {
    if (out.length >= remaining) break;
    if (siblingsToday.has(card.sibling)) continue;
    siblingsToday.add(card.sibling);
    out.push(card);
  }
  return out;
}

function isLearning(s: SavedCard) {
  return s.state === State.Learning || s.state === State.Relearning;
}

/** Review cards due today (before the 4am rollover), most overdue first. */
export function dueReviews(deck: Card[], data: SaveData, now = new Date()): Card[] {
  const dayEnd = nextDayStart(now).getTime();
  return deck
    .filter((c) => {
      const s = data.cards[c.id];
      return s && isActive(c, data) && !isLearning(s) && Date.parse(s.due) < dayEnd;
    })
    .sort((a, b) => Date.parse(data.cards[a.id]!.due) - Date.parse(data.cards[b.id]!.due));
}

function learningCards(deck: Card[], data: SaveData): Card[] {
  return deck.filter((c) => {
    const s = data.cards[c.id];
    return s && isActive(c, data) && isLearning(s);
  });
}

export interface Counts {
  learning: number;
  review: number;
  new: number;
}

export class Session {
  private reviews: Card[];
  private news: Card[];
  private sinceNew = 0;
  private undoStack: { id: string; prev: SavedCard | undefined; logLength: number; sinceNew: number; pool: "review" | "new" | "learning" }[] = [];

  constructor(private deck: Card[], private data: SaveData) {
    this.reviews = dueReviews(deck, data);
    this.news = newCardsToday(deck, data);
  }

  private learningDue(horizon: number): Card[] {
    return learningCards(this.deck, this.data)
      .filter((c) => Date.parse(this.data.cards[c.id]!.due) <= horizon)
      .sort((a, b) => Date.parse(this.data.cards[a.id]!.due) - Date.parse(this.data.cards[b.id]!.due));
  }

  counts(now = Date.now()): Counts {
    return { learning: this.learningDue(now + LEARN_AHEAD_MS).length, review: this.reviews.length, new: this.news.length };
  }

  /** The next card to show, or null when the session is done. */
  next(now = Date.now()): Card | null {
    const learningNow = this.learningDue(now);
    if (learningNow.length) return learningNow[0]!;
    const wantNew = this.news.length > 0 && (this.reviews.length === 0 || this.sinceNew >= REVIEWS_PER_NEW);
    if (wantNew) return this.news[0]!;
    if (this.reviews.length) return this.reviews[0]!;
    return this.learningDue(now + LEARN_AHEAD_MS)[0] ?? null;
  }

  /** Interval each grade would give, for the button labels. */
  preview(card: Card, now = new Date()): Record<number, Date> {
    const saved = this.data.cards[card.id];
    const result = scheduler.repeat(saved ? toFsrs(saved) : createEmptyCard(now), now);
    return Object.fromEntries(GRADES.map((g) => [g.rating, result[g.rating].card.due]));
  }

  grade(card: Card, rating: Grade, asked: string, ms: number, now = new Date()): void {
    const prev = this.data.cards[card.id];
    const pool = !prev ? "new" : isLearning(prev) ? "learning" : "review";
    this.undoStack.push({ id: card.id, prev, logLength: this.data.log.length, sinceNew: this.sinceNew, pool });

    const next = scheduler.next(prev ? toFsrs(prev) : createEmptyCard(now), now, rating);
    this.data.cards[card.id] = fromFsrs(next.card);
    this.data.log.push({ id: card.id, at: now.toISOString(), rating, asked, ms });

    if (pool === "new") {
      this.news = this.news.filter((c) => c.id !== card.id);
      this.data.today.newIds.push(card.id);
      this.sinceNew = 0;
    } else if (pool === "review") {
      this.reviews = this.reviews.filter((c) => c.id !== card.id);
      this.sinceNew++;
    }
    save(this.data);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Revert the last grade and return that card so it can be shown again. */
  undo(): Card | null {
    const u = this.undoStack.pop();
    if (!u) return null;
    const card = this.deck.find((c) => c.id === u.id)!;
    if (u.prev) this.data.cards[u.id] = u.prev;
    else delete this.data.cards[u.id];
    this.data.log.length = u.logLength;
    if (u.pool === "new") {
      this.data.today.newIds = this.data.today.newIds.filter((id) => id !== u.id);
      this.news.unshift(card);
    }
    if (u.pool === "review") this.reviews.unshift(card);
    this.sinceNew = u.sinceNew;
    save(this.data);
    return card;
  }
}

/** Anki-style short interval label: "<1m", "10m", "3d", "2.1mo". */
export function formatInterval(due: Date, now = new Date()): string {
  const mins = (due.getTime() - now.getTime()) / 60_000;
  if (mins < 1) return "<1m";
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
