"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { streamSearch, topRanked } from "./searchStream";

const PAUSE_MS = 100; // same pacing as the search bar's preview
const MIN_CHARS = 2;
const SHOWN = 3;
const EDGE = 12;

// A small search bar that opens at the caret while writing a VerseLink (Tab).
// It works like the top search bar's preview: after a 100ms pause it searches what's
// typed with the same API, algorithms and ranking, and lists the top three matches.
// ↑/↓ choose, Enter picks (the chosen match, or the top one), and the pick becomes a
// VerseRef in the note; Shift+Enter (or Shift+click) adds the verse's text after it. Escape, or a click outside it, cancels. The mouse highlights
// a match only when it actually moves, not when the list appears under a still pointer.
export default function InlineVerseSearch({ rect, onPick, onCancel }) {
  const [value, setValue] = useState("");
  const [res, setRes] = useState({ q: "", items: [], mode: null, state: "idle" });
  const [pick, setPick] = useState(-1);
  const [pos, setPos] = useState(null);
  const box = useRef(null);
  const input = useRef(null);
  const ctrl = useRef(null);

  // Just under the caret, kept inside the window.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const w = el.offsetWidth;
    const left = Math.min(window.innerWidth - EDGE - w, Math.max(EDGE, rect.left));
    setPos({ left: left + window.scrollX, top: rect.bottom + 6 + window.scrollY });
  }, [rect]);

  // Focus only once it's in place, and never let focusing scroll the page (while
  // still parked off screen, focusing would jump the page to the top).
  useEffect(() => {
    if (pos) input.current?.focus({ preventScroll: true });
  }, [pos]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      ctrl.current?.abort();
      setRes({ q: "", items: [], mode: null, state: "idle" });
      return;
    }
    const t = setTimeout(() => {
      ctrl.current?.abort();
      const c = (ctrl.current = new AbortController());
      let items = [], mode = null;
      setPick(-1);
      setRes({ q, items: [], mode: null, state: "searching" });
      streamSearch(q, c.signal, (msg) => {
        if (msg.type === "start") mode = msg.mode;
        else if (msg.type === "matches") {
          items = topRanked(items, msg.items, SHOWN);
          setRes({ q, items, mode, state: "searching" });
        }
      })
        .then((finished) => { if (!c.signal.aborted) setRes({ q, items, mode, state: finished ? "done" : "error" }); })
        .catch((e) => { if (e.name !== "AbortError" && !c.signal.aborted) setRes({ q, items, mode, state: "error" }); });
    }, PAUSE_MS);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => () => ctrl.current?.abort(), []);

  // A click anywhere else cancels.
  useEffect(() => {
    const away = (e) => { if (!box.current?.contains(e.target)) onCancel(false); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [onCancel]);

  const onKey = (e) => {
    const n = res.items.length;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(true); }
    else if (e.key === "ArrowDown" && n) { e.preventDefault(); setPick((p) => (p + 1) % n); }
    else if (e.key === "ArrowUp" && n) { e.preventDefault(); setPick((p) => (p <= 0 ? n - 1 : p - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault(); e.stopPropagation();
      const r = res.items[pick >= 0 ? pick : 0];
      if (r) onPick(r, e.shiftKey); // Shift+Enter: the VerseRef followed by the verse text
    } else if (e.key === "Tab") { e.preventDefault(); e.stopPropagation(); }
  };

  let note = null;
  if (res.state === "error") note = "Something went wrong with the search.";
  else if (res.state === "done" && !res.items.length) note = "No matching verses";
  else if (res.state === "searching" && !res.items.length) note = "Searching…";
  else if (res.state === "idle") note = "Find a verse to reference";

  return createPortal(
    <div
      ref={box}
      className="ve-inline-search"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
    >
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder="Search a verse…"
        aria-label="Search for a verse to reference"
        autoComplete="off"
        spellCheck="false"
        role="combobox"
        aria-expanded={res.items.length > 0}
        aria-activedescendant={pick >= 0 ? `ivs-${pick}` : undefined}
      />
      {(res.items.length > 0 || note) && (
        <div className="ivs-list" role="listbox" aria-label="Matching verses">
          {res.items.map((r, i) => (
            <button
              type="button"
              key={`${r.slug}-${r.c}-${r.v}`}
              id={`ivs-${i}`}
              role="option"
              aria-selected={i === pick}
              className={i === pick ? "ivs-item on" : "ivs-item"}
              onMouseMove={() => setPick(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => onPick(r, e.shiftKey)}
            >
              <span className="ivs-text">{r.text}</span>
              <span className="ivs-where">
                {r.book} {r.c}:{r.v}
                {res.mode !== "reference" && <span className="ivs-score">{Math.round(r.score * 100)}% match</span>}
              </span>
            </button>
          ))}
          {note && <p className="ivs-note">{note}</p>}
        </div>
      )}
    </div>,
    document.body
  );
}
