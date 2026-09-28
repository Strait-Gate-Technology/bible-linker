// Red letter data: which words are Christ's, for the WEB and KJV.
// Run after the other imports: npm run import-redletter
//
// The texts in app-data come from sources that don't mark Christ's words, so this
// reads editions that do (from github.com/seven1m/open-bibles):
//   WEB  eng-web.usfx.xml   <wj>…</wj>
//   KJV  eng-kjv.osis.xml   <q who="Jesus" sID=…/> … <q eID=…/>
// For every verse containing such words, the marked edition is aligned word by word
// with the text already stored (longest common subsequence on normalised words),
// and each stored word takes its partner's colour. Words with no exact partner (a
// spelling difference between editions) are red only if the words on both sides are.
//
// Output: app-data/bible/<version>/red.json
//   { "<book slug>": { "<chapter>": { "<verse>": [[fromWord, toWord], …] } } }
// Word numbers count words within the verse (splitting each stored segment on
// spaces, across all of the verse's segments), ranges end exclusive. The BBE has
// no red letter edition, so it gets none.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "https://raw.githubusercontent.com/seven1m/open-bibles/master/";
const ROOT = path.join(process.cwd(), "app-data", "bible");

const USFX = ["MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH",
  "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV"];
const OSIS = ["Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess",
  "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John", "Jude", "Rev"];

const tokens = (xml) => xml.match(/<[^>]+>|[^<]+/g) ?? [];
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'");

// Each parser returns Map "slug|chapter|verse" → [{ text, red }], for verses with any red.
function parseUsfx(xml, slugs) {
  const out = new Map();
  let book = null, ch = 0, vs = 0, inVerse = false, wj = 0, skip = 0, chunks = null;
  const flush = () => { if (chunks?.some((c) => c.red)) out.set(`${book}|${ch}|${vs}`, chunks); chunks = null; };
  for (const t of tokens(xml)) {
    if (t[0] !== "<") { if (book && inVerse && !skip) chunks.push({ text: decode(t), red: wj > 0 }); continue; }
    const name = t.match(/^<\/?([a-zA-Z0-9]+)/)?.[1];
    const closing = t[1] === "/", selfClosing = t.endsWith("/>");
    if (name === "book") { flush(); inVerse = false; book = slugs[USFX.indexOf(attr(t, "id"))] ?? null; continue; }
    if (!book) continue;
    if (["f", "x", "h", "toc", "id", "ide", "fe"].includes(name) && !selfClosing) { skip += closing ? -1 : 1; continue; }
    if (name === "c" && !closing) { flush(); inVerse = false; ch = Number(attr(t, "id")); continue; }
    if (name === "v" && !closing) { flush(); vs = Number(attr(t, "id")); inVerse = true; chunks = []; continue; }
    if (name === "ve") { flush(); inVerse = false; continue; }
    if (name === "wj" && !selfClosing) { wj += closing ? -1 : 1; continue; }
  }
  flush();
  return out;
}

function parseOsis(xml, slugs) {
  const out = new Map();
  const jesus = new Set();
  let key = null, red = 0, skip = 0, chunks = null;
  const flush = () => { if (key && chunks?.some((c) => c.red)) out.set(key, chunks); key = null; chunks = null; };
  for (const t of tokens(xml)) {
    if (t[0] !== "<") { if (key && !skip) chunks.push({ text: decode(t), red: red > 0 }); continue; }
    const name = t.match(/^<\/?([a-zA-Z0-9]+)/)?.[1];
    const closing = t[1] === "/", selfClosing = t.endsWith("/>");
    if (["note", "title"].includes(name) && !selfClosing) { skip += closing ? -1 : 1; continue; }
    if (name === "verse") {
      const id = attr(t, "osisID");
      if (id && attr(t, "sID") !== undefined || (id && !selfClosing)) {
        flush();
        const [b, c, v] = id.split(".");
        const slug = slugs[OSIS.indexOf(b)];
        if (slug) { key = `${slug}|${Number(c)}|${Number(v)}`; chunks = []; }
      } else if (attr(t, "eID") !== undefined) flush();
      continue;
    }
    if (name === "q") {
      if (attr(t, "who") === "Jesus") {
        if (attr(t, "sID")) { jesus.add(attr(t, "sID")); red++; }
        else if (!selfClosing) red++;
      } else if (attr(t, "eID") && jesus.has(attr(t, "eID"))) { jesus.delete(attr(t, "eID")); red = Math.max(0, red - 1); }
      else if (closing && red > 0) red--; // closing tag of a container <q who="Jesus">
      continue;
    }
  }
  flush();
  return out;
}

// Normalised word for matching: lower case letters and digits only.
const norm = (w) => w.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");

// Split marked chunks into words; a word is red if most of its letters are.
function markedWords(chunks) {
  const chars = [];
  for (const c of chunks) for (const ch of c.text) chars.push([ch, c.red]);
  const words = [];
  let cur = null;
  for (const [ch, red] of chars) {
    if (/\s/.test(ch)) { if (cur) words.push(cur); cur = null; continue; }
    cur ??= { text: "", redLetters: 0, letters: 0 };
    cur.text += ch;
    if (/[A-Za-z0-9]/.test(ch)) { cur.letters++; if (red) cur.redLetters++; }
  }
  if (cur) words.push(cur);
  return words.map((w) => ({ n: norm(w.text), red: w.letters ? w.redLetters * 2 > w.letters : false }));
}

// Longest common subsequence alignment → for each of `ours`, the index in `theirs` or -1.
function align(ours, theirs) {
  const n = ours.length, m = theirs.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = ours[i] && ours[i] === theirs[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const map = new Array(n).fill(-1);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (ours[i] && ours[i] === theirs[j]) { map[i] = j; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return map;
}

async function build(version, url, parse) {
  const index = JSON.parse(await readFile(path.join(ROOT, version, "index.json"), "utf8"));
  const slugs = index.books.slice(39).map((b) => b.slug); // NT, in canonical order
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const marked = parse(await res.text(), slugs);

  const out = {};
  let verses = 0, words = 0, matched = 0;
  for (const slug of slugs) {
    const book = JSON.parse(await readFile(path.join(ROOT, version, `${slug}.json`), "utf8"));
    for (const [c, paras] of Object.entries(book.chapters)) {
      // this version's words, per verse, exactly as the page splits them
      const byVerse = new Map();
      let cur = 0;
      for (const p of paras) for (const line of p.lines) for (const [v, text] of line) {
        if (v > 0) cur = v;
        if (!byVerse.has(cur)) byVerse.set(cur, []);
        byVerse.get(cur).push(...text.split(" "));
      }
      for (const [v, ourWords] of byVerse) {
        const src = marked.get(`${slug}|${Number(c)}|${v}`);
        if (!src) continue;
        const theirs = markedWords(src);
        const ours = ourWords.map(norm);
        const map = align(ours, theirs.map((w) => w.n));
        const red = map.map((j) => (j >= 0 ? theirs[j].red : null));
        // unmatched words: red only if the nearest matched words on both sides are
        for (let i = 0; i < red.length; i++) {
          if (red[i] !== null) continue;
          let a = i - 1; while (a >= 0 && red[a] === null) a--;
          let b = i + 1; while (b < red.length && map[b] < 0) b++;
          const left = a >= 0 ? red[a] : null, right = b < red.length ? theirs[map[b]].red : null;
          red[i] = (left ?? right ?? false) && (right ?? left ?? false);
        }
        const ranges = [];
        red.forEach((r, i) => {
          if (!r) return;
          const last = ranges[ranges.length - 1];
          if (last && last[1] === i) last[1] = i + 1; else ranges.push([i, i + 1]);
        });
        verses++; words += ours.length; matched += map.filter((j) => j >= 0).length;
        if (!ranges.length) continue;
        ((out[slug] ??= {})[c] ??= {})[v] = ranges;
      }
    }
  }
  await writeFile(path.join(ROOT, version, "red.json"), JSON.stringify(out));
  const redVerses = Object.values(out).reduce((s, b) => s + Object.values(b).reduce((t, ch) => t + Object.keys(ch).length, 0), 0);
  console.log(`✓ ${version}: ${redVerses} verses with red words; ${(100 * matched / words).toFixed(1)}% of words aligned exactly across ${verses} marked verses`);
}

await build("web", SRC + "eng-web.usfx.xml", parseUsfx);
await build("kjv", SRC + "eng-kjv.osis.xml", parseOsis);
