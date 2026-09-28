"use client";

import { useEffect, useState } from "react";

const KEY = "bible-linker:red";

// Bold J: Christ's words in red are on.
function J() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <text x="8" y="12.2" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif" fill="currentColor">J</text>
    </svg>
  );
}

// No entry sign (a circle with a bar across it): red letter text is off.
function NoEntry() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="5.6" />
      <path d="M5.2 8h5.6" />
    </svg>
  );
}

// Red letter switch: white while off, red while on; the knob slides and both
// colours change over 85ms. It toggles .redletter on <html>, which turns the words
// marked as Christ's (.wj) red. Off by default; the choice is remembered.
export default function RedLetterToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === "on"); } catch {}
    const onReset = () => setOn(false);
    window.addEventListener("bible-linker:reset", onReset);
    return () => window.removeEventListener("bible-linker:reset", onReset);
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("redletter", next);
    try { next ? localStorage.setItem(KEY, "on") : localStorage.removeItem(KEY); } catch {}
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Christ's words in red"
      title={on ? "Christ's words in red: on" : "Christ's words in red: off"}
      className={on ? "redswitch on" : "redswitch"}
      onClick={toggle}
    >
      <span className="knob">{on ? <J /> : <NoEntry />}</span>
    </button>
  );
}
