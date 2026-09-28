"use client";

import { useEffect } from "react";

// ← and → step back and forward one chapter (across book boundaries, like the
// pager). Ignored while typing (inputs, the Verse Editor's text, dropdowns), with
// modifier keys held, or when a key was already handled by something else.
export default function ChapterKeys({ prev, next }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (document.documentElement.dataset.help === "open") return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], .nav-panel")) return;
      const ref = e.key === "ArrowLeft" ? prev : next;
      if (!ref) return;
      e.preventDefault();
      window.location.assign(`/?ref=${encodeURIComponent(ref)}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return null;
}
