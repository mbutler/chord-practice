# Chord Practice

Spaced-repetition practice for Piano For All chords, inversions and progressions,
built for an iPad at the piano.

- **Chord shapes (Tier 1):** see a chord symbol, play it in the inversion asked for
  (Root, Backwards / 1st inversion, Middle / 2nd inversion; picked at random each review).
- **Progressions (Tiers 2–3):** play a progression in a given key, starting from a given
  inversion, voice-led so the hand barely moves. A rhythm style is picked at random each review.
- Right-hand shapes follow Piano For All: 7ths and 6ths are 3-note shapes (C7 = Bb E G),
  with the left hand assumed to play the root.
- Scheduling is FSRS (the algorithm Anki uses), with Again / Hard / Good / Easy.

## Build & deploy

```bash
bun install
bun run build
```

Upload everything in `dist/` to any folder on your web server. There's no server-side code.

On the iPad: open the page, then **Share → Add to Home Screen**. This matters.
Progress is stored in the browser, and iPad browsers can clear site data after about a
week without visits unless the site is on the Home Screen. Use **Settings → Export backup**
now and then.

After uploading a new build, reload the page. If your server caches `index.html`
aggressively, set it to `no-cache`. Everything else is cache-busted automatically.

## Develop

```bash
bun test            # music theory, deck and scheduler tests
bun run typecheck
```

| Path | What it is |
| --- | --- |
| `src/theory/shapes.ts` | Piano For All chord shapes and inversions |
| `src/theory/voicing.ts` | Voice-leading solver (least total finger travel) |
| `src/deck/definitions.ts` | Curriculum: chord types, progressions, hints, rhythm styles, introduction order |
| `src/deck/generate.ts` | Expands definitions across 12 keys into `deck.json` |
| `src/app/` | The web app: scheduler (FSRS), storage, keyboard SVG, screens |

Card ids are stable (`t3_iivi_bb_mid`), and saved progress is keyed on them. Renaming a
progression id or key slug orphans its history.
