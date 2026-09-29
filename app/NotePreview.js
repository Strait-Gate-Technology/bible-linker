"use client";

import { useLayoutEffect, useRef } from "react";

const LINES = 2; // lines of a note shown in its preview

// Formatting kept in a preview; everything else (links included) becomes plain text.
const KEEP = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL"]);

// A note's text as a small tree of formatted runs: its paragraphs one after another,
// separated by spaces, with bold, italic, underline and strikethrough kept (so a
// note that starts with a bold line gets a bold "title" in its preview) and runs of
// whitespace squeezed to one space. Parsed in a <template>, where nothing loads or
// runs, and rebuilt from scratch, so stored data can't put anything else on the page.
function toRuns(content) {
  const out = document.createDocumentFragment();
  const copy = (from, to) => {
    for (const n of from.childNodes) {
      if (n.nodeType === 3) to.append(n.textContent.replace(/\s+/g, " "));
      else if (n.nodeType === 1 && n.tagName === "BR") to.append(" ");
      else if (n.nodeType === 1 && KEEP.has(n.tagName)) copy(n, to.appendChild(document.createElement(n.tagName.toLowerCase())));
      else if (n.nodeType === 1) copy(n, to);
    }
  };
  for (const b of content?.blocks ?? []) {
    const t = document.createElement("template");
    t.innerHTML = b.data?.text ?? "";
    if (out.childNodes.length) out.append(" ");
    copy(t.content, out);
  }
  return out;
}

// The first n characters of the runs (formatting intact), then "..." when cut.
function cutRuns(runs, n, ellipsis) {
  const frag = runs.cloneNode(true);
  let left = n;
  const walk = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walk.nextNode()) texts.push(walk.currentNode);
  let last = null;
  for (const t of texts) {
    if (left <= 0) { t.remove(); continue; }
    if (t.textContent.length > left) t.textContent = t.textContent.slice(0, left);
    left -= t.textContent.length;
    last = t;
  }
  if (ellipsis && last) {
    last.textContent = last.textContent.replace(/[\s,.;:!?—–-]+$/, "") + "...";
  }
  // Drop formatting left empty by the cut.
  frag.querySelectorAll("b, strong, i, em, u, s, strike, del").forEach((el) => { if (!el.textContent) el.remove(); });
  return frag;
}

// A folded note's preview, used by the Verse Editor's list and by the bubble over a
// highlight so a note looks the same in both: as much of its text as fits on two
// lines, in regular text with the note's own bold, italic, underline and
// strikethrough, ending in "..." where it's cut. The cut is measured (binary search
// on the length) and falls between words where one is close by.
export default function NotePreview({ content }) {
  const el = useRef(null);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const runs = toRuns(content);
    const lead = runs.textContent.length - runs.textContent.trimStart().length;
    const text = runs.textContent;
    const show = (n, more) => node.replaceChildren(cutRuns(runs, n, more));
    const fit = () => {
      if (!text.trim()) { node.textContent = "(empty)"; return; }
      const lh = parseFloat(getComputedStyle(node).lineHeight) || 18;
      const fits = () => node.scrollHeight <= lh * LINES + 1; // a pixel of slack for rounding
      show(text.length, false);
      if (fits()) return;
      let lo = lead, hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        show(mid, true);
        if (fits()) lo = mid; else hi = mid - 1;
      }
      // Back up to the end of a word if one is close by, so words aren't split.
      let cut = lo;
      const space = text.lastIndexOf(" ", lo);
      if (space > lead && lo - space <= 12 && /\S/.test(text[lo] ?? " ")) cut = space;
      show(cut, true);
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit); // the row narrows while "Are you sure?" shows
    ro.observe(node);
    return () => ro.disconnect();
  }, [content]);

  return <span ref={el} className="ve-entry-text" />;
}
