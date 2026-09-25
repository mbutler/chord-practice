// Build the static site into dist/: generate the deck, bundle the app, copy
// the page shell. Upload the contents of dist/ to any web server.

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { generateDeck } from "../src/deck/generate";

const OUT = "dist";

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const deck = generateDeck();
const deckJson = JSON.stringify(deck);
await writeFile(`${OUT}/deck.json`, deckJson);

const result = await Bun.build({
  entrypoints: ["src/app/main.ts"],
  outdir: OUT,
  naming: "app.js",
  target: "browser",
  minify: true,
  sourcemap: "linked",
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp("public", OUT, { recursive: true });

// Cache-busting token so the iPad picks up new builds.
const appJs = await readFile(`${OUT}/app.js`);
const css = await readFile(`${OUT}/styles.css`);
const build = Bun.hash(Buffer.concat([appJs, css, Buffer.from(JSON.stringify(deck.cards))])).toString(36);
const html = (await readFile(`${OUT}/index.html`, "utf8")).replaceAll("{{BUILD}}", build);
await writeFile(`${OUT}/index.html`, html);

console.log(`Built ${deck.cards.length} cards → ${OUT}/ (build ${build}, app ${(appJs.length / 1024).toFixed(0)} KB, deck ${(deckJson.length / 1024).toFixed(0)} KB)`);
