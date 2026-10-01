import { beforeAll, describe, expect, test } from "bun:test";
import { Rating, State } from "ts-fsrs";
import { generateDeck } from "../src/deck/generate";
import { CATEGORY_FILTERS } from "../src/deck/categories";
import { currentLevel, dueReviews, newCardsToday, Session } from "../src/app/scheduler";
import { emptyData, nextDayStart, studyDay } from "../src/app/store";

beforeAll(() => {
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
  } as Storage;
});

const deck = generateDeck().cards;

describe("new cards", () => {
  test("start with only three familiar major root positions", () => {
    const first = newCardsToday(deck, emptyData()).map((c) => c.id);
    expect(first).toEqual(["t1_c_maj_root", "t1_g_maj_root", "t1_f_maj_root"]);
    expect(first).toHaveLength(3);
  });

  test("respect the daily limit, including cards already introduced today", () => {
    const data = emptyData();
    data.today.newIds = ["x", "y", "z"];
    data.settings.newPerDay = 5;
    expect(newCardsToday(deck, data)).toHaveLength(2);
    data.settings.newPerDay = 0;
    expect(newCardsToday(deck, data)).toHaveLength(0);
  });

  test("never introduce two start-inversions of the same progression+key on one day", () => {
    const data = emptyData();
    data.settings.newPerDay = 50;
    for (const f of CATEGORY_FILTERS) data.settings.categories[f.id] = f.id === "backbone";
    const cards = newCardsToday(deck, data);
    expect(cards.length).toBe(1);   // one per key
    expect(new Set(cards.map((c) => c.sibling)).size).toBe(cards.length);
  });

  test("successful recall unlocks early rhythm; struggling holds the stage", () => {
    const data = emptyData();
    const session = new Session(deck, data);
    const first = newCardsToday(deck, data);
    for (const card of first) session.grade(card, Rating.Easy, "Root", 1000);
    expect(currentLevel(deck, data)).toBe(2);
    const next = session.next()!;
    expect(next.kind).toBe("progression");
    expect(next.kind === "progression" && next.guided).toBe(true);
    session.undo();
    expect(currentLevel(deck, data)).toBe(1);
    session.grade(first[2]!, Rating.Hard, "Root", 1000);
    expect(currentLevel(deck, data)).toBe(1);
    expect(newCardsToday(deck, data)).toHaveLength(0);
  });

  test("all triad roots precede inversion recall; inversions have independent ids", () => {
    const triads = deck.filter((c) => c.kind === "chord" && ["Major", "Minor"].includes(c.quality));
    expect(triads.filter((c) => c.kind === "chord" && c.targetInversion === 0).every((c) => c.level < 9)).toBe(true);
    expect(triads.filter((c) => c.kind === "chord" && c.targetInversion === 2).every((c) => c.level >= 11)).toBe(true);
    expect(new Set(triads.map((c) => c.id)).size).toBe(72);
  });

  test("disabled categories are skipped", () => {
    const data = emptyData();
    data.settings.categories.chords = false;
    expect(newCardsToday(deck, data).every((c) => c.categoryId !== "chords")).toBe(true);
  });

  test("every card belongs to a category the settings screen can toggle", () => {
    const ids = new Set(CATEGORY_FILTERS.map((f) => f.id));
    for (const c of deck) expect(ids.has(c.categoryId)).toBe(true);
  });
});

describe("session", () => {
  test("a new card graded Good enters learning and comes back", () => {
    const data = emptyData();
    const s = new Session(deck, data);
    const t0 = new Date();
    const card = s.next(t0.getTime())!;
    s.grade(card, Rating.Good, "Root", 1000, t0);

    expect(data.cards[card.id]!.state).toBe(State.Learning);
    expect(data.today.newIds).toEqual([card.id]);
    expect(s.counts(t0.getTime()).new).toBe(2);
    // Not due yet a second later, but due after its learning step.
    expect(s.next(t0.getTime() + 1000)?.id).not.toBe(card.id);
    expect(s.next(t0.getTime() + 11 * 60_000)?.id).toBe(card.id);
  });

  test("undo restores the card, the log and today's new count", () => {
    const data = emptyData();
    const s = new Session(deck, data);
    const card = s.next()!;
    s.grade(card, Rating.Easy, "Root", 1000);
    expect(s.undo()?.id).toBe(card.id);
    expect(data.cards[card.id]).toBeUndefined();
    expect(data.log).toHaveLength(0);
    expect(data.today.newIds).toHaveLength(0);
    expect(s.next()?.id).toBe(card.id);
  });

  test("reviews due before the 4am rollover count as today's", () => {
    const data = emptyData();
    const now = new Date();
    const card = deck[0]!;
    const base = { stability: 5, difficulty: 5, elapsed_days: 0, scheduled_days: 3, reps: 3, lapses: 0, learning_steps: 0, state: State.Review };
    data.cards[card.id] = { ...base, due: new Date(nextDayStart(now).getTime() - 60_000).toISOString() };
    expect(dueReviews(deck, data, now).map((c) => c.id)).toEqual([card.id]);
    data.cards[card.id] = { ...base, due: new Date(nextDayStart(now).getTime() + 60_000).toISOString() };
    expect(dueReviews(deck, data, now)).toHaveLength(0);
  });

  test("new cards are mixed in between reviews", () => {
    const data = emptyData();
    const now = new Date();
    // Make 6 chord cards due for review.
    for (const c of deck.filter((c) => c.categoryId === "chords").slice(-6)) {
      data.cards[c.id] = { stability: 5, difficulty: 5, elapsed_days: 0, scheduled_days: 3, reps: 3, lapses: 0, learning_steps: 0, state: State.Review, due: new Date(now.getTime() - 3600_000).toISOString() };
    }
    const s = new Session(deck, data);
    const kinds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const c = s.next(now.getTime())!;
      kinds.push(data.cards[c.id] ? "R" : "N");
      s.grade(c, Rating.Easy, "", 0, now);
    }
    expect(kinds.join("")).toBe("RRRNRRRN");
  });
});

test("study day rolls over at 4am", () => {
  expect(studyDay(new Date(2026, 8, 25, 3, 59))).toBe("2026-09-24");
  expect(studyDay(new Date(2026, 8, 25, 4, 1))).toBe("2026-09-25");
});
