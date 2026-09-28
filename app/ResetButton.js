"use client";

import { freezeLines } from "./textFreeze";
import { VERSION_COOKIE } from "../lib/versions";

const KEYS = ["bible-linker:size", "bible-linker:align", "bible-linker:width", "bible-linker:font", "bible-linker:red"];
const DEFAULTS = { "--reader-size": "16pt", "--align": "justify" };

// A counter-clockwise arrow wrapped around a clock face — "back in time" / restore.
function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.13" />
      <path d="M3.5 4.5v5h5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

export default function ResetButton({ version }) {

  const reset = () => {
    try {
      KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {}
    const root = document.documentElement;
    Object.entries(DEFAULTS).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.removeProperty("--reader-font"); // back to the stylesheet's Roboto
    root.classList.remove("redletter");
    document.querySelector(".reader")?.style.removeProperty("width");

    // Let SizeStepper / FontSelect / RedLetterToggle sync their own displayed state,
    // then re-measure line breaks now that size/width/font are back to their defaults.
    window.dispatchEvent(new Event("bible-linker:reset"));
    document.fonts.ready.then(() => requestAnimationFrame(freezeLines));

    // The version is a cookie read by the server, so going back to WEB needs a reload.
    if (version && version !== "web") {
      document.cookie = `${VERSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
      window.location.reload();
    }
  };

  return (
    <button type="button" className="reset" aria-label="Reset all settings" onClick={reset}>
      <HistoryIcon />
      <span className="tip" aria-hidden="true">Reset all settings</span>
    </button>
  );
}
