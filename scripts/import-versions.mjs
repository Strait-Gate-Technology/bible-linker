// Downloads the KJV and the Bible in Basic English (both public domain) and converts
// them into the same per-book JSON shape as the WEB in app-data/bible/web/.
// Run after import-web.mjs: npm run import-versions
//
// The sources are verse lists with no paragraph information, so each chapter borrows
// the WEB's paragraph and poetry layout: every verse is placed where the same verse
// sits in the WEB. A verse the WEB splits over several poetry lines stays on the
// first of them; any verse the WEB lacks is slotted in right after the verse before it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/";
const ROOT = path.join(process.cwd(), "app-data", "bible");

const VERSIONS = [
  { id: "kjv", file: "KJV.json", translation: "King James Version (1769)" },
  { id: "bbe", file: "BBE.json", translation: "Bible in Basic English (1965)" },
];

const webIndex = JSON.parse(await readFile(path.join(ROOT, "web", "index.json"), "utf8"));

function layout(template, verses) {
  // The BBE marks a few passages it leaves untranslated with "***" (and one stray "+");
  // show those as an ellipsis, and skip any verse the source leaves empty.
  const clean = (t) => t.replace(/\*{3}/g, "…").replace(/\s\+\s*$/, "").replace(/\s+/g, " ").trim();
  const text = new Map(verses.map((v) => [v.verse, clean(v.text)]).filter(([, t]) => t));
  const placed = new Set();
  const paras = (template ?? []).map((p) => ({
    poetry: p.poetry,
    lines: p.lines.map((line) =>
      line
        .filter(([v]) => v > 0 && text.has(v) && !placed.has(v))
        .map(([v]) => (placed.add(v), [v, text.get(v)]))
    ),
  }));

  // Verses with no slot in the WEB layout go right after the nearest earlier verse.
  for (const v of [...text.keys()].sort((a, b) => a - b)) {
    if (placed.has(v)) continue;
    let target = null;
    for (const p of paras) for (const l of p.lines) l.forEach(([n], i) => { if (n < v && (!target || n > target.n)) target = { n, l, i }; });
    if (target) target.l.splice(target.i + 1, 0, [v, text.get(v)]);
    else if (paras[0]) paras[0].lines[0].unshift([v, text.get(v)]);
    else paras.push({ poetry: false, lines: [[[v, text.get(v)]]] });
    placed.add(v);
  }

  return paras
    .map((p) => ({ poetry: p.poetry, lines: p.lines.filter((l) => l.length) }))
    .filter((p) => p.lines.length);
}

for (const { id, file, translation } of VERSIONS) {
  const res = await fetch(SRC + file);
  if (!res.ok) throw new Error(`Failed to download ${file}: ${res.status}`);
  const { books } = await res.json();
  if (books.length !== webIndex.books.length) throw new Error(`${file}: expected ${webIndex.books.length} books, got ${books.length}`);

  const out = path.join(ROOT, id);
  await mkdir(out, { recursive: true });
  const index = [];
  for (const [i, { slug, name }] of webIndex.books.entries()) {
    const web = JSON.parse(await readFile(path.join(ROOT, "web", `${slug}.json`), "utf8"));
    const chapters = {};
    for (const ch of books[i].chapters) chapters[ch.chapter] = layout(web.chapters[ch.chapter], ch.verses);
    await writeFile(path.join(out, `${slug}.json`), JSON.stringify({ slug, name, chapters }));
    index.push({ slug, name, chapters: Object.keys(chapters).length });
  }
  await writeFile(path.join(out, "index.json"), JSON.stringify({
    translation,
    license: "Public domain",
    source: "https://github.com/scrollmapper/bible_databases",
    books: index,
  }, null, 1));
  console.log(`✓ ${translation}: ${index.length} books`);
}
