import { readFile } from "node:fs/promises";
import path from "node:path";

import { versionOf } from "./versions";
import { resolveBook, keyOf } from "./books";

// The Bible text lives in the app's own data folder (one subfolder per version) and is read from disk.
const DATA_ROOT = path.join(process.cwd(), "app-data", "bible");
const dir = (version) => path.join(DATA_ROOT, versionOf(version).id);

const indexCache = new Map();
export async function getIndex(version) {
  const key = versionOf(version).id;
  if (!indexCache.has(key)) indexCache.set(key, JSON.parse(await readFile(path.join(dir(key), "index.json"), "utf8")));
  return indexCache.get(key);
}

const bookCache = new Map();
async function getBook(version, slug) {
  const key = `${versionOf(version).id}/${slug}`;
  if (!bookCache.has(key)) {
    bookCache.set(key, JSON.parse(await readFile(path.join(dir(version), `${slug}.json`), "utf8")));
  }
  return bookCache.get(key);
}

// Accepts "John 1", "Jn 1", "1 cor 13", "song of solomon 2", "ps 23", "Rev 12",
// "romans" (→ chapter 1). Book names and abbreviations come from lib/books.js.
export async function resolveReference(input, fallback = { book: "john", chapter: 1 }) {
  const match = String(input ?? "").trim().match(/^(.*?)[\s.:]*(\d+)?(?:[:.]\d+.*)?$/);
  const raw = match?.[1] ?? "";
  const chapter = match?.[2] ? parseInt(match[2], 10) : 1;
  if (!keyOf(raw)) return fallback;
  const hit = resolveBook(raw);
  if (!hit) return null;
  return { book: hit.slug, chapter: Math.min(Math.max(chapter, 1), hit.chapters) };
}

export async function getChapter(bookSlug, chapter, version) {
  const [book, { books }] = await Promise.all([getBook(version, bookSlug), getIndex(version)]);
  const paragraphs = book.chapters[String(chapter)];
  if (!paragraphs) return null;

  const i = books.findIndex((b) => b.slug === bookSlug);
  const ref = (b, c) => `${b.name} ${c}`;
  let prev = null, next = null;
  if (chapter > 1) prev = ref(books[i], chapter - 1);
  else if (i > 0) prev = ref(books[i - 1], books[i - 1].chapters);
  if (chapter < books[i].chapters) next = ref(books[i], chapter + 1);
  else if (i < books.length - 1) next = ref(books[i + 1], 1);

  return { name: book.name, chapter, paragraphs, prev, next };
}

// Every verse of a book as flat { c, v, text } rows, joining a verse that the
// layout splits across several poetry lines back into one string. Used by search.
const verseCache = new Map();
export async function getVerses(version, bookSlug) {
  const key = `${versionOf(version).id}/${bookSlug}`;
  if (!verseCache.has(key)) {
    const book = await getBook(version, bookSlug);
    const rows = [];
    for (const [c, paras] of Object.entries(book.chapters)) {
      let row = null;
      for (const p of paras) for (const line of p.lines) for (const [v, text] of line) {
        if (v > 0) rows.push((row = { c: Number(c), v, text }));
        else if (row) row.text += " " + text;
      }
    }
    verseCache.set(key, rows);
  }
  return verseCache.get(key);
}

// "John 3:16", "Jn 3:16-18", "Matthew 25:24,27,29", "ps 23", "1 cor 13:4-7" →
// { book, name, chapter, verses?, from?, to? }. verses lists every verse asked for
// (ranges expanded, gaps kept); from/to are its first and last. Anything that doesn't
// end in a chapter (and optional verses) is not a reference.
export async function parseReference(input) {
  const s = String(input ?? "").trim();
  const m = s.match(/^(.*?\D)\s*(\d+)(?:\s*[:.]\s*(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*))?\s*$/);
  if (!m) return null;
  const hit = await resolveReference(`${m[1]} ${m[2]}`, null);
  if (!hit || hit.chapter !== Number(m[2])) return null; // chapter out of range: not a real reference
  const { books } = await getIndex();
  const name = books.find((b) => b.slug === hit.book).name;
  if (!m[3]) return { ...hit, name };
  const verses = new Set();
  for (const part of m[3].split(",")) {
    const [a, b] = part.split(/[-–]/).map((x) => parseInt(x, 10));
    for (let v = Math.min(a, b ?? a); v <= Math.max(a, b ?? a) && v - Math.min(a, b ?? a) < 200; v++) verses.add(v);
  }
  const list = [...verses].sort((x, y) => x - y);
  return { ...hit, name, verses: list, from: list[0], to: list[list.length - 1] };
}

// For the toolbar navigator: every book with the verse count of each chapter, in
// the chosen version. [{ slug, name, verses: [31, 25, …] }]
const navCache = new Map();
export async function getNavData(version) {
  const key = versionOf(version).id;
  if (!navCache.has(key)) {
    const { books } = await getIndex(key);
    const data = await Promise.all(
      books.map(async ({ slug, name, chapters }) => {
        const counts = new Array(chapters).fill(0);
        for (const r of await getVerses(key, slug)) counts[r.c - 1] = Math.max(counts[r.c - 1], r.v);
        return { slug, name, verses: counts };
      })
    );
    navCache.set(key, data);
  }
  return navCache.get(key);
}

// Red letter ranges for one chapter: { verse: [[fromWord, toWord], …] } (see
// scripts/import-redletter.mjs). Versions without a red letter edition return {}.
const redCache = new Map();
export async function getRed(version, bookSlug, chapter) {
  const key = versionOf(version).id;
  if (!redCache.has(key)) {
    let data = {};
    try { data = JSON.parse(await readFile(path.join(dir(key), "red.json"), "utf8")); } catch {}
    redCache.set(key, data);
  }
  return redCache.get(key)[bookSlug]?.[String(chapter)] ?? {};
}
