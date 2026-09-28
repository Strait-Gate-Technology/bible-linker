"use client";

import { useEffect } from "react";
import { freezeLines } from "./textFreeze";
import { onVerseClick } from "./verseActions";

// Hover focus: the verse under the pointer gets data-hot on all of its words;
// CSS eases it larger and bolder, and eases it back the same way on leave.
// Frozen line breaks (see textFreeze.js) are re-measured on resize and
// whenever the text-size or column-width controls change ("reader-size").
const LEAVE_DELAY_MS = 0; // no grace period — verse switches highlight immediately

export default function VerseFocus() {
  useEffect(() => {
    const byVerse = new Map();
    document.querySelectorAll(".reader .w[data-v]").forEach((el) => {
      const key = el.dataset.v;
      if (!byVerse.has(key)) byVerse.set(key, []);
      byVerse.get(key).push(el);
    });

    let hot = null;
    let leaveTimer = 0;
    const setHot = (verse) => {
      if (verse === hot) return;
      byVerse.get(hot)?.forEach((el) => el.removeAttribute("data-hot"));
      byVerse.get(verse)?.forEach((el) => el.setAttribute("data-hot", ""));
      hot = verse;
    };
    const onMove = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const word = target?.closest(".reader .w");
      if (word) { clearTimeout(leaveTimer); setHot(word.dataset.v); return; }
      if (target?.closest(".reader .line")) { clearTimeout(leaveTimer); return; } // between lines: keep focus
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => setHot(null), LEAVE_DELAY_MS);
    };
    const onLeave = () => { clearTimeout(leaveTimer); leaveTimer = setTimeout(() => setHot(null), LEAVE_DELAY_MS); };

    // Clicking a verse opens the Verse Editor for it (see verseActions.js).
    const onClick = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const word = target?.closest(".reader .w");
      if (!word) return;
      onVerseClick(word.dataset.v, word, e);
    };

    let timer = 0;
    const refreeze = () => { clearTimeout(timer); timer = setTimeout(freezeLines, 150); };
    let alive = true;
    document.fonts.ready.then(() => { if (alive) freezeLines(); }); // measure once Roboto is in

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    // Shift+click groups verses (see VerseEditor); stop Shift+mousedown from also
    // making a browser text selection across them.
    // Likewise a double click (which starts a new note) shouldn't select the word.
    const onDown = (e) => {
      if ((e.shiftKey || e.detail > 1) && e.target instanceof Element && e.target.closest(".reader .w")) e.preventDefault();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("click", onClick);
    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) onLeave(); });
    window.addEventListener("blur", onLeave);
    window.addEventListener("resize", refreeze);
    window.addEventListener("reader-size", refreeze);

    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(leaveTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("click", onClick);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("resize", refreeze);
      window.removeEventListener("reader-size", refreeze);
    };
  }, []);

  return null;
}
