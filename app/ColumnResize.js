"use client";

import { useEffect, useRef } from "react";
import { freezeLines, unfreezeLines } from "./textFreeze";

const KEY = "bible-linker:width";
const MIN_W = 260;
const maxW = () => Math.min(1040, window.innerWidth - 56);

// A vertical bar pinned to the right edge of the text column. Drag it and the
// column's width follows the pointer 1:1; release and the line breaks are
// re-measured and pinned at the new width, which is then remembered.
export default function ColumnResize() {
  const drag = useRef(null);

  useEffect(() => {
    const reader = document.querySelector(".reader");
    if (!reader) return;
    try {
      const saved = parseInt(localStorage.getItem(KEY), 10);
      if (saved) reader.style.width = `${Math.min(maxW(), Math.max(MIN_W, saved))}px`;
    } catch {}

    const onResize = () => {
      const w = reader.getBoundingClientRect().width;
      const clamped = Math.min(maxW(), Math.max(MIN_W, w));
      if (Math.abs(clamped - w) > 0.5) reader.style.width = `${clamped}px`;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const reader = document.querySelector(".reader");
    if (!reader) return;
    e.preventDefault();
    drag.current = { x: e.clientX, w: reader.getBoundingClientRect().width };
    unfreezeLines(); // let the text reflow live while dragging
    document.documentElement.classList.add("resizing");
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const reader = document.querySelector(".reader");
    if (!reader) return;
    // The column is centred, so its right edge moves at half the rate its width
    // does; doubling the pointer delta makes the bar track the cursor exactly.
    const next = Math.min(maxW(), Math.max(MIN_W, drag.current.w + 2 * (e.clientX - drag.current.x)));
    reader.style.width = `${next}px`;
  };

  const endDrag = (e) => {
    if (!drag.current) return;
    drag.current = null;
    document.documentElement.classList.remove("resizing");
    const reader = document.querySelector(".reader");
    if (reader) {
      const w = Math.round(reader.getBoundingClientRect().width);
      try { localStorage.setItem(KEY, String(w)); } catch {}
    }
    freezeLines();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div
      className="handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize the text column"
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
