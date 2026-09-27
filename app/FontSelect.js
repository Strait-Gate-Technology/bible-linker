"use client";

import { useEffect, useState } from "react";

// Every font is bundled from npm (@fontsource-variable, the same files the
// fontsource/jsDelivr CDN serves) so nothing is fetched from a third party.
// All are variable, so the hover's Light → Regular weight shift stays smooth.
export const FONTS = [
  { id: "roboto", label: "Roboto", stack: '"Roboto Variable", "Roboto", system-ui, sans-serif' },
  { id: "literata", label: "Literata", stack: '"Literata Variable", Georgia, serif' },
  { id: "crimson", label: "Crimson Pro", stack: '"Crimson Pro Variable", Georgia, serif' },
  { id: "source-sans", label: "Source Sans 3", stack: '"Source Sans 3 Variable", system-ui, sans-serif' },
  { id: "noto-serif", label: "Noto Serif", stack: '"Noto Serif Variable", Georgia, serif' },
];
export const DEFAULT_FONT = "roboto";
const KEY = "bible-linker:font";

export default function FontSelect() {
  const [font, setFont] = useState(DEFAULT_FONT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (FONTS.some((f) => f.id === saved)) setFont(saved);
    } catch {}
    const onReset = () => setFont(DEFAULT_FONT);
    window.addEventListener("bible-linker:reset", onReset);
    return () => window.removeEventListener("bible-linker:reset", onReset);
  }, []);

  const change = (e) => {
    const f = FONTS.find((x) => x.id === e.target.value) ?? FONTS[0];
    setFont(f.id);
    document.documentElement.style.setProperty("--reader-font", f.stack);
    try { localStorage.setItem(KEY, f.id); } catch {}
    // Re-pin line breaks once the new face has actually loaded, not before.
    const family = f.stack.split(",")[0];
    Promise.all([document.fonts.load(`300 1em ${family}`), document.fonts.load(`400 1em ${family}`)])
      .catch(() => {})
      .then(() => window.dispatchEvent(new Event("reader-size")));
  };

  return (
    <label className="pick font" title="Font">
      <span className="sr">Font</span>
      <select value={font} onChange={change}>
        {FONTS.map((f) => (
          <option key={f.id} value={f.id} style={{ fontFamily: f.stack }}>{f.label}</option>
        ))}
      </select>
    </label>
  );
}
