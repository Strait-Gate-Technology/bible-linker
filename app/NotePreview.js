"use client";

import { useLayoutEffect, useRef, useState } from "react";

const TITLE_WORDS = 5;  // the bold title: a note's first words, as many of these as fit
const SUB_WORDS = 24;   // the subtext under it: the rest of that sentence, at most this many words

// A folded note's preview, used by the Verse Editor's list and by the bubble over a
// highlight so a note looks the same in both: its first five words in bold as a title, cut to what fits
// on one line and ending in "..." when the note goes on; below it, in smaller
// regular text, the words that follow, up to the end of that sentence (or about a
// sentence's worth). The subtext starts exactly where the title stopped, so no word
// is skipped when fewer than five fit.
const trimEnd = (s) => s.trimEnd().replace(/[\s,.;:!?—–-]+$/, "");

export default function NotePreview({ text }) {
  const title = useRef(null);
  const words = text.split(" ").filter(Boolean);
  const [used, setUsed] = useState(Math.min(TITLE_WORDS, words.length)); // words shown in the title

  useLayoutEffect(() => {
    const node = title.current;
    if (!node) return;
    const fit = () => {
      const max = Math.min(TITLE_WORDS, words.length);
      for (let k = max; k >= 1; k--) {
        const more = k < words.length;
        const head = words.slice(0, k).join(" ");
        node.textContent = more ? trimEnd(head) + "..." : head;
        if (node.scrollWidth <= node.clientWidth) { setUsed(k); return; }
      }
      // Not even one word fits: cut the first word itself.
      const w = words[0] ?? "";
      let lo = 0, hi = w.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        node.textContent = w.slice(0, mid) + "...";
        if (node.scrollWidth <= node.clientWidth) lo = mid; else hi = mid - 1;
      }
      node.textContent = w.slice(0, lo) + "...";
      setUsed(1);
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit); // the row narrows while "Are you sure?" shows
    ro.observe(node);
    return () => ro.disconnect();
  }, [text]);

  // The rest of the sentence after the title.
  const rest = words.slice(used);
  const sub = [];
  for (const w of rest) {
    sub.push(w);
    if (/[.!?]["'”’)\]]*$/.test(w) || sub.length >= SUB_WORDS) break;
  }
  const cutShort = sub.length < rest.length && !/[.!?]["'”’)\]]*$/.test(sub[sub.length - 1] ?? "");

  return (
    <>
      <span ref={title} className="ve-entry-title">{words.slice(0, TITLE_WORDS).join(" ")}</span>
      {sub.length > 0 && (
        <span className="ve-entry-sub">{cutShort ? trimEnd(sub.join(" ")) + "..." : sub.join(" ")}</span>
      )}
    </>
  );
}

