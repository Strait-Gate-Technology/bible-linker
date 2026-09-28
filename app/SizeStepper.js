"use client";

import { useEffect, useState } from "react";

export const MIN_PT = 12;
export const MAX_PT = 48;
export const DEFAULT_PT = 16;
const KEY = "bible-linker:size";

function Minus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

function Plus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

// (−) 16 pt (+) — steps the resting text size by 1pt within MIN_PT..MAX_PT.
export default function SizeStepper() {
  const [pt, setPt] = useState(DEFAULT_PT);

  // Pick up a saved size (the inline script in layout.js already applied it before paint).
  useEffect(() => {
    try {
      const saved = parseInt(localStorage.getItem(KEY), 10);
      if (saved >= MIN_PT && saved <= MAX_PT) setPt(saved);
    } catch {}
    const onReset = () => setPt(DEFAULT_PT);
    window.addEventListener("bible-linker:reset", onReset);
    return () => window.removeEventListener("bible-linker:reset", onReset);
  }, []);

  const set = (next) => {
    next = Math.min(MAX_PT, Math.max(MIN_PT, next));
    if (next === pt) return;
    setPt(next);
    document.documentElement.style.setProperty("--reader-size", `${next}pt`);
    try { localStorage.setItem(KEY, String(next)); } catch {}
    window.dispatchEvent(new Event("reader-size"));
  };

  return (
    <div className="size" role="group" aria-label="Text size">
      <button type="button" onClick={() => set(pt - 1)} disabled={pt <= MIN_PT} aria-label="Decrease text size">
        <Minus />
      </button>
      <output className="pt" aria-live="polite">{pt} pt</output>
      <button type="button" onClick={() => set(pt + 1)} disabled={pt >= MAX_PT} aria-label="Increase text size">
        <Plus />
      </button>
    </div>
  );
}
