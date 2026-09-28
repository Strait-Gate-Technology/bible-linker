// VerseLinks: notes attached to a verse, written in the Verse Editor.
//
// Persisted in localStorage under "link-data" as an array of VerseLinks. localStorage
// belongs to the user's own browser profile, so links are private to that user and
// never shared across the site or with other visitors.
//
// VerseLink = {
//   id:      string,
//   anchor:  { book, chapter, verse, verses },
//                                        // the verse or verses it belongs to, all in one
//                                        // chapter: verses is the sorted list (a Shift+
//                                        // click group may be contiguous or have gaps),
//                                        // verse is its first. book is a slug ("john"),
//                                        // so it holds in every translation. Links from
//                                        // before groups existed have only verse.
//   content: { time, blocks, version },  // the rich text, as Editor.js saves it
//   refs:    [{ label, book, chapter, verse, href }],
//                                        // inline verse references found in the text
//   created: number, updated: number,    // ms timestamps
//   color:   "yellow" | "green" | …,     // its highlighter colour (see HIGHLIGHTS)
//   tilt:    number,                     // its highlight's angle, 0 to 2 degrees
// }
export const LINK_KEY = "link-data";
export const LINKS_CHANGED = "bible-linker:links-changed";

export function loadLinks() {
  try {
    const all = JSON.parse(localStorage.getItem(LINK_KEY));
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

function saveLinks(all) {
  try { localStorage.setItem(LINK_KEY, JSON.stringify(all)); } catch {}
  window.dispatchEvent(new Event(LINKS_CHANGED));
}

// The verses an anchor (or a link's anchor) covers.
export const versesOfAnchor = (a) => (Array.isArray(a?.verses) && a.verses.length ? a.verses : a?.verse ? [a.verse] : []);
export const versesOf = (link) => versesOfAnchor(link.anchor);

export function makeAnchor(book, chapter, verses) {
  const list = [...new Set(verses.map(Number))].sort((x, y) => x - y);
  return { book, chapter, verse: list[0], verses: list };
}

// "24-25" for a run, "24,27,29" with gaps, and "24-25,29" for a mix.
export function formatVerses(verses) {
  const list = [...new Set(verses.map(Number))].sort((x, y) => x - y);
  const runs = [];
  for (const v of list) {
    const last = runs[runs.length - 1];
    if (last && v === last[1] + 1) last[1] = v; else runs.push([v, v]);
  }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(",");
}

// Every link on this chapter that touches any of the anchor's verses, oldest first.
export function linksFor(anchor) {
  const want = new Set(versesOfAnchor(anchor));
  return loadLinks()
    .filter((l) => l.anchor && l.anchor.book === anchor.book && l.anchor.chapter === anchor.chapter && versesOf(l).some((v) => want.has(v)))
    .sort((a, b) => a.created - b.created);
}

export function upsertLink(link) {
  const all = loadLinks();
  const i = all.findIndex((l) => l.id === link.id);
  const next = { ...link, updated: Date.now() };
  if (i >= 0) all[i] = next; else all.push(next);
  saveLinks(all);
  return next;
}

export function removeLink(id) {
  const all = loadLinks();
  const next = all.filter((l) => l.id !== id);
  if (next.length !== all.length) saveLinks(next);
}

export const newLinkId = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// ---------- reading the rich text ----------
const stripTags = (html) => {
  const el = document.createElement("div");
  el.innerHTML = html ?? "";
  return el.textContent ?? "";
};

// Plain text of every block, for previews and emptiness checks.
export const plainText = (content) =>
  (content?.blocks ?? []).map((b) => stripTags(b.data?.text)).join(" ").replace(/\s+/g, " ").trim();

// Inline verse references are ordinary links to a verse (/?ref=John%203&v=18)
// inside the text; this collects them, in order, without duplicates.
export function refsIn(content) {
  const out = [], seen = new Set();
  for (const b of content?.blocks ?? []) {
    const el = document.createElement("div");
    el.innerHTML = b.data?.text ?? "";
    for (const a of el.querySelectorAll("a[href]")) {
      let url;
      try { url = new URL(a.getAttribute("href"), window.location.origin); } catch { continue; }
      const ref = url.searchParams.get("ref"), verse = Number(url.searchParams.get("v"));
      const m = ref?.match(/^(.*\S)\s+(\d+)$/);
      if (url.pathname !== "/" || !m || !verse) continue;
      const label = `${m[1]} ${m[2]}:${verse}`;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ label, book: m[1], chapter: Number(m[2]), verse, href: url.pathname + url.search });
    }
  }
  return out;
}

// "the first five words of the note..." for the collapsed list.
export function previewOf(link, words = 5) {
  const all = plainText(link.content).split(" ").filter(Boolean);
  return all.slice(0, words).join(" ") + (all.length > words ? "..." : "");
}

// ---------- highlighter colours ----------
// Each VerseLink has a highlighter colour: a strip beside it in the Verse Editor,
// and the colour its verse is highlighted in. Stored as full colours; the
// highlights are made translucent as a group (see HighlightLayer.js).
export const HIGHLIGHTS = {
  yellow: "#ffd84d",
  green: "#6fe07a",
  blue: "#5ab8ff",
  pink: "#ff6fb5",
  orange: "#ff9f43",
  violet: "#a98bff",
};
const NAMES = Object.keys(HIGHLIGHTS);

const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

// Links saved before colours existed get a steady one from their id.
export const colorNameOf = (link) => (HIGHLIGHTS[link.color] ? link.color : NAMES[hash(link.id) % NAMES.length]);
export const colorOf = (link) => HIGHLIGHTS[colorNameOf(link)];
export const tiltOf = (link) => (typeof link.tilt === "number" ? link.tilt : (hash(`${link.id}t`) % 201) / 100);

// A colour for a new link: one its verse doesn't use yet, if any are left.
export function chooseColor(existing) {
  const used = new Set(existing.map(colorNameOf));
  const free = NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
export const chooseTilt = () => Math.round(Math.random() * 200) / 100; // 0 to 2 degrees
