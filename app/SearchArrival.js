"use client";

import { useEffect } from "react";

const PAUSE_MS = 150;       // a beat at the top of the chapter before moving
const MIN_SCROLL_MS = 300;  // scroll time grows with distance, within these bounds
const MAX_SCROLL_MS = 700;
const LAND_AT = 0.3;        // the verse settles about a third of the way down the screen

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // ease in out cubic

// A chapter opened from a search result (?v=…) arrives in three steps: it starts at
// the top, glides quickly down to the verse, then everything but that verse fades
// to 30% opacity in 85ms (".focusing", see globals.css). The first click anywhere
// lifts the dimming and drops ?v from the address, so a reload reads normally.
export default function SearchArrival() {
  useEffect(() => {
    const reader = document.querySelector(".reader");
    const target = document.querySelector(".reader .w.hit");
    if (!reader || !target) return;

    let released = false, done = false, frame = 0, timer = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try { history.scrollRestoration = "manual"; } catch {}
    window.scrollTo(0, 0);

    const dim = () => { if (!released) reader.classList.add("focusing"); };

    const stopScroll = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      dim();
    };

    const release = () => {
      released = true;
      stopScroll();
      reader.classList.remove("focusing");
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("v");
        window.history.replaceState(window.history.state, "", url);
      } catch {}
    };

    const glide = () => {
      if (done) return;
      const from = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const to = Math.max(0, Math.min(max, target.getBoundingClientRect().top + from - window.innerHeight * LAND_AT));
      const dist = Math.abs(to - from);
      if (reduced || dist < 4) { window.scrollTo(0, to); stopScroll(); return; }
      const dur = Math.min(MAX_SCROLL_MS, Math.max(MIN_SCROLL_MS, 250 + dist * 0.25));
      const t0 = performance.now();
      const step = (now) => {
        if (done) return;
        const t = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) frame = requestAnimationFrame(step);
        else stopScroll();
      };
      frame = requestAnimationFrame(step);
    };

    // Wait for the font, then for the line breaks to be pinned (VerseFocus does that
    // on the same signal), so the verse's position is final before measuring it.
    document.fonts.ready.then(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => { timer = setTimeout(glide, PAUSE_MS); }))
    );

    // If the reader scrolls or presses a key mid glide, hand control back at once.
    const takeOver = () => stopScroll();
    document.addEventListener("click", release, { capture: true, once: true });
    window.addEventListener("wheel", takeOver, { passive: true, once: true });
    window.addEventListener("touchstart", takeOver, { passive: true, once: true });
    window.addEventListener("keydown", takeOver, { once: true });

    return () => {
      done = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      document.removeEventListener("click", release, { capture: true });
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchstart", takeOver);
      window.removeEventListener("keydown", takeOver);
    };
  }, []);

  return null;
}
