"use client";

import { useEffect } from "react";

// Tab jumps straight into the search bar, caret at the end of whatever is there
// (except while writing a VerseLink, where Tab opens the inline verse search).
// The key is absorbed: the browser's own Tab (moving focus from control to
// control) no longer happens. Shift+Tab is left alone, so keyboard users can
// still step backwards through the page's controls.
export default function TabToSearch() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Tab" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.documentElement.dataset.help === "open") { e.preventDefault(); return; } // help is up
      // Inside a VerseLink note, Tab belongs to the Verse Editor (inline verse search).
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest(".ve-slot, .ve-inline-search")) return;
      e.preventDefault();
      e.stopPropagation();
      const input = document.getElementById("q");
      if (!input) return;
      input.focus();
      const end = input.value.length;
      try { input.setSelectionRange(end, end); } catch {}
    };
    window.addEventListener("keydown", onKey, true); // capture: ahead of anything else on the page
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return null;
}
