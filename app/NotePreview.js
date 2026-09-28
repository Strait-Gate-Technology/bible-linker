"use client";

import { useLayoutEffect, useRef } from "react";

const LINES = 2; // lines of a note shown in its preview

// A folded note's preview, used by the Verse Editor's list and by the bubble over a
// highlight so a note looks the same in both: as much of its text as fits on two
// lines, in regular text, ending in "..." where it's cut. The cut is measured
// (binary search on the length) and falls between words where one is close by.
const trimEnd = (s) => s.trimEnd().replace(/[\s,.;:!?—–-]+$/, "");

export default function NotePreview({ text }) {
  const el = useRef(null);

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const fit = () => {
      const lh = parseFloat(getComputedStyle(node).lineHeight) || 18;
      const max = lh * LINES + 1; // a pixel of slack for rounding
      const fits = () => node.scrollHeight <= max;
      node.textContent = text;
      if (fits()) return;
      let lo = 0, hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        node.textContent = trimEnd(text.slice(0, mid)) + "...";
        if (fits()) lo = mid; else hi = mid - 1;
      }
      // Back up to the end of a word if one is close by, so words aren't split.
      let cut = lo;
      const space = text.lastIndexOf(" ", lo);
      if (space > 0 && lo - space <= 12 && /\S/.test(text[lo] ?? " ")) cut = space;
      node.textContent = trimEnd(text.slice(0, cut)) + "...";
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit); // the row narrows while "Are you sure?" shows
    ro.observe(node);
    return () => ro.disconnect();
  }, [text]);

  return <span ref={el} className="ve-entry-text">{text}</span>;
}
