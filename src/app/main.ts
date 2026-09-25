import type { Card, ChordCard, Deck, Inversion, ProgressionCard, Voicing } from "../types";
import { inversionLabel, INVERSION_LABELS } from "../types";
import { CATEGORY_FILTERS } from "../deck/categories";
import { keyboardSvg, rangeFor } from "./keyboard";
import { formatInterval, GRADES, isActive, Session } from "./scheduler";
import {
  emptyData, exportBackup, importBackup, load, requestPersistence, save,
  type PromptStyle, type SaveData,
} from "./store";

// ── State ────────────────────────────────────────────────────────────────

let deck: Card[] = [];
let data: SaveData = load();
let session: Session | null = null;

/** The card on screen and what its randomised front asked for. */
interface Showing {
  card: Card;
  inversion: Inversion;   // chord cards: which inversion to play
  style: string;          // progression cards: rhythm modifier
  revealed: boolean;
  shownAt: number;
  answerMs: number;
}
let showing: Showing | null = null;

const app = document.getElementById("app")!;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

// ── Routing ──────────────────────────────────────────────────────────────

type Route = "home" | "study" | "library" | "settings";

function go(route: Route, arg?: string) {
  location.hash = arg ? `${route}/${encodeURIComponent(arg)}` : route;
}

function render() {
  const [route, arg] = location.hash.slice(1).split("/");
  window.scrollTo(0, 0);
  switch (route) {
    case "study": return renderStudy();
    case "library": return renderLibrary(arg ? decodeURIComponent(arg) : undefined);
    case "settings": return renderSettings();
    default: return renderHome();
  }
}

window.addEventListener("hashchange", render);

// ── Shared pieces ────────────────────────────────────────────────────────

function topBar(title: string, right = ""): string {
  return `<header class="bar">
    <button class="link" data-go="home" aria-label="Home">‹ Home</button>
    <h1>${esc(title)}</h1>
    <div class="bar-right">${right}</div>
  </header>`;
}

function voicingTile(v: Voicing, opts: { roman?: string; highlight?: boolean; heldFrom?: Voicing; motion?: string; range: { lo: number; hi: number } }): string {
  const dots = v.midi.map((m, i) => ({ midi: m, label: v.names[i]!, held: opts.heldFrom?.midi.includes(m) }));
  return `<figure class="tile${opts.highlight ? " asked" : ""}">
    <figcaption>
      <span class="sym">${esc(v.symbol)}</span>${opts.roman ? `<span class="roman">${esc(opts.roman)}</span>` : ""}
      <span class="inv">${esc(inversionLabel(v.inversion))}</span>
    </figcaption>
    ${keyboardSvg(dots, opts.range, `${v.symbol}: ${v.names.join(" ")}`)}
    ${opts.motion ? `<p class="motion">${opts.motion}</p>` : ""}
  </figure>`;
}

function motionText(card: ProgressionCard, i: number): string {
  const m = card.motions[i - 1];
  if (!m) return "";
  const held = m.held.length ? `Hold <b>${m.held.map(esc).join(" ")}</b>` : "Nothing held";
  const moves = m.moves.map((x) => `${esc(x.from)}→${esc(x.to)}`).join(", ");
  return `${held}${moves ? ` · ${moves}` : ""}`;
}

/** Chord line for the front of a progression card, per the prompt-style setting. */
function progressionPrompt(card: ProgressionCard, style: PromptStyle): string {
  const romanOf = new Map(card.symbols.map((s, i) => [s, card.roman[i]!]));
  const main = style === "roman" ? card.roman : card.symbols;
  const sub = style === "both" ? card.roman : null;

  if (card.form) {
    const bars = card.form.map((s) => `<div class="bar-cell"><span>${esc(style === "roman" ? romanOf.get(s)! : s)}</span>${
      style === "both" ? `<small>${esc(romanOf.get(s)!)}</small>` : ""}</div>`);
    return `<div class="form">${bars.join("")}</div>`;
  }
  return `<p class="chords">${main.map(esc).join(`<span class="arrow">→</span>`)}</p>${
    sub ? `<p class="chords-sub">${sub.map(esc).join(" → ")}</p>` : ""}`;
}

// ── Home ─────────────────────────────────────────────────────────────────

const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function renderHome() {
  session = new Session(deck, data);
  const c = session.counts();
  const total = c.learning + c.review + c.new;
  const active = deck.filter((card) => isActive(card, data));
  const seen = active.filter((card) => data.cards[card.id]).length;

  const byCategory = CATEGORY_FILTERS.filter((f) => data.settings.categories[f.id] !== false).map((f) => {
    const cards = deck.filter((card) => card.categoryId === f.id);
    const started = cards.filter((card) => data.cards[card.id]).length;
    const pct = Math.round((started / cards.length) * 100);
    return `<li><span>${esc(f.label)}</span><span class="meter"><span style="width:${pct}%"></span></span><span class="num">${started}/${cards.length}</span></li>`;
  });

  app.innerHTML = `
    <main class="home">
      <h1 class="title">Chord Practice</h1>
      <p class="subtitle">Piano For All · chords, inversions &amp; progressions</p>
      ${isStandalone() ? "" : `<p class="notice">Progress is saved in this browser only. To keep it safe, add this page to your Home Screen (Share → Add to Home Screen) and export a backup now and then from Settings.</p>`}
      <section class="counts">
        <div><b class="n-learn">${c.learning}</b><span>Learning</span></div>
        <div><b class="n-review">${c.review}</b><span>Review</span></div>
        <div><b class="n-new">${c.new}</b><span>New</span></div>
      </section>
      <button class="primary big" data-go="study" ${total ? "" : "disabled"}>${total ? "Start practice" : "All done for today"}</button>
      <section class="progress">
        <h2>Cards started <span class="num">${seen} of ${active.length}</span></h2>
        <ul>${byCategory.join("")}</ul>
      </section>
      <nav class="home-nav">
        <button data-go="library">Library</button>
        <button data-go="settings">Settings</button>
      </nav>
    </main>`;
}

// ── Study ────────────────────────────────────────────────────────────────

function lastAsked(id: string): string | undefined {
  for (let i = data.log.length - 1; i >= 0; i--) if (data.log[i]!.id === id) return data.log[i]!.asked;
}

function show(card: Card) {
  let inversion: Inversion = 0;
  let style = "";
  if (card.kind === "chord") {
    // Rotate through inversions: never ask for the same one twice in a row.
    const prev = lastAsked(card.id);
    const options = ([0, 1, 2] as Inversion[]).filter((i) => INVERSION_LABELS[i].pfa !== prev);
    inversion = pick(options);
  } else {
    style = pick(card.styles);
  }
  showing = { card, inversion, style, revealed: false, shownAt: Date.now(), answerMs: 0 };
}

function renderStudy() {
  if (!session) session = new Session(deck, data);
  if (!showing) {
    const next = session.next();
    if (!next) {
      app.innerHTML = `${topBar("Practice")}<main class="done"><h2>Done for now</h2><p>Nothing else is due. Come back tomorrow, or later today if you have cards in learning.</p><button class="primary" data-go="home">Home</button></main>`;
      return;
    }
    show(next);
  }
  const s = showing!;
  const c = session.counts();
  const right = `<span class="mini-counts"><span class="n-learn">${c.learning}</span> <span class="n-review">${c.review}</span> <span class="n-new">${c.new}</span></span>
    <button class="link" data-action="undo" ${session.canUndo() ? "" : "disabled"}>Undo</button>`;

  app.innerHTML = `${topBar(s.card.category, right)}
    <main class="study">
      <section class="front">${s.card.kind === "chord" ? chordFront(s.card, s.inversion) : progressionFront(s.card, s.style)}</section>
      ${s.revealed ? `<section class="back">${s.card.kind === "chord" ? chordBack(s.card, s.inversion) : progressionBack(s.card)}</section>` : ""}
      <footer class="actions">${s.revealed ? gradeButtons(s.card) : `<button class="primary big" data-action="reveal">Show answer</button>`}</footer>
    </main>`;
}

function chordFront(card: ChordCard, inv: Inversion): string {
  return `<p class="eyebrow">Play this chord</p>
    <p class="symbol">${esc(card.symbol)}</p>
    <p class="chip">${esc(inversionLabel(inv))}</p>`;
}

function chordBack(card: ChordCard, inv?: Inversion): string {
  const hint = `<p class="hint"><b>${esc(card.quality)}:</b> ${esc(card.hint)}</p>`;
  const range = rangeFor(card.inversions.flatMap((v) => v.midi));
  if (inv === undefined) {
    return `<div class="tiles">${card.inversions.map((v) => voicingTile(v, { range })).join("")}</div>${hint}`;
  }
  // The asked-for inversion large, on its own keyboard; the other two as reference.
  const asked = card.inversions[inv]!;
  const others = card.inversions.filter((_, i) => i !== inv);
  return `<div class="tiles solo">${voicingTile(asked, { range: rangeFor(asked.midi), highlight: true })}</div>
    ${hint}
    <p class="others-label">Other inversions</p>
    <div class="tiles pair">${others.map((v) => voicingTile(v, { range })).join("")}</div>`;
}

function progressionFront(card: ProgressionCard, style: string): string {
  return `<p class="eyebrow">${esc(card.name)} · Key of ${esc(card.key)}</p>
    ${progressionPrompt(card, data.settings.promptStyle)}
    <p class="chip">Start: ${esc(inversionLabel(card.startInversion))}</p>
    <p class="chip style">${esc(style)}</p>`;
}

function progressionBack(card: ProgressionCard): string {
  const range = rangeFor(card.steps.flatMap((v) => v.midi));
  const tiles = card.steps.map((v, i) =>
    voicingTile(v, { range, roman: card.roman[i], heldFrom: card.steps[i - 1], motion: motionText(card, i) }));
  return `<div class="tiles steps">${tiles.join("")}</div>
    <p class="legend"><span class="lg-dot"></span> play <span class="lg-held"></span> held from the previous chord</p>
    <p class="hint">${esc(card.hint)}</p>`;
}

function gradeButtons(card: Card): string {
  const due = session!.preview(card);
  return `<div class="grades">${GRADES.map((g) => `<button class="grade g${g.rating}" data-grade="${g.rating}">
      <span>${g.label}</span><small>${formatInterval(due[g.rating]!)}</small></button>`).join("")}</div>`;
}

function reveal() {
  if (!showing || showing.revealed) return;
  showing.revealed = true;
  showing.answerMs = Date.now() - showing.shownAt;
  renderStudy();
}

function grade(rating: number) {
  if (!showing?.revealed || !session) return;
  const s = showing;
  const asked = s.card.kind === "chord" ? INVERSION_LABELS[s.inversion].pfa : s.style;
  session.grade(s.card, rating as 1 | 2 | 3 | 4, asked, s.answerMs);
  showing = null;
  renderStudy();
}

function undo() {
  const card = session?.undo();
  if (!card) return;
  show(card);
  renderStudy();
}

// ── Library ──────────────────────────────────────────────────────────────

let libraryQuery = "";

function cardTitle(card: Card): string {
  return card.kind === "chord" ? card.symbol : `${card.name} in ${card.key}`;
}

function cardSubtitle(card: Card): string {
  return card.kind === "chord" ? card.quality : `${card.symbols.join(" → ")} · from ${INVERSION_LABELS[card.startInversion].pfa}`;
}

function renderLibrary(id?: string) {
  const card = id ? deck.find((c) => c.id === id) : undefined;
  if (card) {
    const back = card.kind === "chord" ? chordBack(card) : progressionBack(card);
    app.innerHTML = `${topBar("Library", `<button class="link" data-go="library">All cards</button>`)}
      <main class="study"><section class="front compact"><p class="eyebrow">${esc(card.category)}</p><p class="symbol small">${esc(cardTitle(card))}</p>
      ${card.kind === "progression" ? progressionPrompt(card, data.settings.promptStyle) : ""}</section>
      <section class="back">${back}</section></main>`;
    return;
  }

  app.innerHTML = `${topBar("Library")}
    <main class="library">
      <input type="search" id="q" placeholder="Search: Gm7, blues, Bb, walkdown…" value="${esc(libraryQuery)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      <ul id="results" class="results"></ul>
    </main>`;
  const input = document.getElementById("q") as HTMLInputElement;
  const results = document.getElementById("results")!;
  const update = () => {
    libraryQuery = input.value;
    const terms = libraryQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = deck.filter((c) => {
      const hay = `${cardTitle(c)} ${cardSubtitle(c)} ${c.category}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    }).slice(0, 80);
    results.innerHTML = matches.map((c) => `<li><button data-open="${esc(c.id)}"><b>${esc(cardTitle(c))}</b><small>${esc(cardSubtitle(c))}</small></button></li>`).join("")
      || `<li class="empty">No matches</li>`;
  };
  input.addEventListener("input", update);
  update();
}

// ── Settings ─────────────────────────────────────────────────────────────

function renderSettings() {
  const s = data.settings;
  const styleOption = (v: PromptStyle, label: string) =>
    `<label class="seg"><input type="radio" name="promptStyle" value="${v}" ${s.promptStyle === v ? "checked" : ""}><span>${label}</span></label>`;

  app.innerHTML = `${topBar("Settings")}
    <main class="settings">
      <section>
        <h2>Daily new cards</h2>
        <div class="stepper">
          <button data-step="-5" aria-label="Fewer">−</button><output id="newPerDay">${s.newPerDay}</output><button data-step="5" aria-label="More">+</button>
        </div>
        <p class="help">How many new cards to introduce each day. Reviews are never limited.</p>
      </section>
      <section>
        <h2>Progression prompts</h2>
        <div class="segmented">${styleOption("symbols", "Chord symbols")}${styleOption("roman", "Roman numerals")}${styleOption("both", "Both")}</div>
      </section>
      <section>
        <h2>What to practice</h2>
        <ul class="toggles">${CATEGORY_FILTERS.map((f) => {
          const n = deck.filter((c) => c.categoryId === f.id).length;
          return `<li><label><input type="checkbox" data-category="${f.id}" ${s.categories[f.id] !== false ? "checked" : ""}><span>${esc(f.label)}</span><small>Tier ${f.tier} · ${n} cards</small></label></li>`;
        }).join("")}</ul>
      </section>
      <section>
        <h2>Backup</h2>
        <p class="help">Your progress lives only in this browser. Export a backup now and then; import restores it (replacing what's here).</p>
        <div class="row">
          <button data-action="export">Export backup</button>
          <label class="button">Import backup<input type="file" id="import" accept="application/json,.json" hidden></label>
        </div>
        <p class="help" id="persist"></p>
      </section>
      <section class="danger">
        <h2>Reset</h2>
        <button data-action="reset" class="destructive">Erase all progress</button>
      </section>
    </main>`;

  document.querySelectorAll<HTMLInputElement>("input[name=promptStyle]").forEach((el) =>
    el.addEventListener("change", () => { data.settings.promptStyle = el.value as PromptStyle; save(data); }));
  document.querySelectorAll<HTMLInputElement>("input[data-category]").forEach((el) =>
    el.addEventListener("change", () => { data.settings.categories[el.dataset.category!] = el.checked; save(data); }));
  document.getElementById("import")!.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const restored = await importBackup(file);
      if (!confirm(`Replace current progress with this backup (${Object.keys(restored.cards).length} cards studied)?`)) return;
      data = restored;
      save(data);
      session = null;
      alert("Backup restored.");
      renderSettings();
    } catch (err) {
      alert((err as Error).message);
    }
  });
  requestPersistence().then((ok) => {
    const el = document.getElementById("persist");
    if (el) el.textContent = ok ? "This browser has agreed to keep your data." : "";
  });
}

// ── Events ───────────────────────────────────────────────────────────────

app.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("button, [data-go]");
  if (!el || (el as HTMLButtonElement).disabled) return;
  const d = el.dataset;
  if (d.go) {
    if (d.go === "study") showing = null;
    return go(d.go as Route);
  }
  if (d.open) return go("library", d.open);
  if (d.grade) return grade(Number(d.grade));
  if (d.step) {
    data.settings.newPerDay = Math.max(0, Math.min(50, data.settings.newPerDay + Number(d.step)));
    save(data);
    document.getElementById("newPerDay")!.textContent = String(data.settings.newPerDay);
    return;
  }
  switch (d.action) {
    case "reveal": return reveal();
    case "undo": return undo();
    case "export": return exportBackup(data);
    case "reset":
      if (confirm("Erase all progress and settings? This can't be undone (unless you have a backup).")) {
        data = emptyData();
        save(data);
        session = null;
        go("home");
      }
  }
});

// Keyboard shortcuts (iPad Magic Keyboard / desktop): space reveals, 1–4 grade, z undoes.
document.addEventListener("keydown", (e) => {
  if (!location.hash.startsWith("#study") || e.metaKey || e.ctrlKey || (e.target as HTMLElement).tagName === "INPUT") return;
  if ((e.key === " " || e.key === "Enter") && showing && !showing.revealed) { e.preventDefault(); reveal(); }
  else if (showing?.revealed && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key));
  else if (e.key === "z") undo();
});

// A new study day may start while the app sits open on the iPad.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const fresh = load();
  if (fresh.today.day !== data.today.day) {
    data = fresh;
    session = null;
    showing = null;
    render();
  }
});

// ── Boot ─────────────────────────────────────────────────────────────────

async function boot() {
  try {
    const res = await fetch(`deck.json?v=${document.documentElement.dataset.build ?? ""}`);
    deck = ((await res.json()) as Deck).cards;
  } catch {
    app.innerHTML = `<main class="done"><h2>Couldn't load the deck</h2><p>Check that deck.json was uploaded next to index.html.</p></main>`;
    return;
  }
  render();
}

boot();
