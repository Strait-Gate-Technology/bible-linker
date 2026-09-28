"use client";

import { useEffect, useRef, useState } from "react";
import { noteOrigin, LAST_SEARCH_KEY } from "./searchSession";
import { streamSearch, topRanked, verseHref } from "./searchStream";

const PAUSE_MS = 100;  // typing must rest this long before a preview search starts
const MIN_CHARS = 2;   // "a few letters"
const SHOWN = 3;       // matches in the preview

function Magnifier() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 L20.5 20.5" />
    </svg>
  );
}

// Verse search, at the top of every page. Submitting (Enter) goes to the full
// results page, /search?q=… As you type, once the typing pauses for 100ms, a live
// preview searches what's there so far (same API, same algorithms, same ranking)
// and shows the top three matches just below the bar, refining as more of the
// Bible is searched. ↑/↓ pick a match, Enter opens it, Escape hides the preview.
// The mouse highlights a match only when it actually moves.
export default function SearchBox({ defaultValue = "" }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState({ q: "", items: [], mode: null, state: "idle" });
  const [pick, setPick] = useState(-1);
  const root = useRef(null);
  const input = useRef(null);
  const ctrl = useRef(null);
  const timer = useRef(0);

  // Search the current text after a 100ms pause; each new pause cancels the last.
  useEffect(() => {
    clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      ctrl.current?.abort();
      setPreview({ q: "", items: [], mode: null, state: "idle" });
      return;
    }
    if (q === preview.q) return;
    timer.current = setTimeout(() => {
      ctrl.current?.abort();
      const c = (ctrl.current = new AbortController());
      let items = [], mode = null;
      setPick(-1);
      setPreview({ q, items: [], mode: null, state: "searching" });
      streamSearch(q, c.signal, (msg) => {
        if (msg.type === "start") mode = msg.mode;
        else if (msg.type === "matches") {
          items = topRanked(items, msg.items, SHOWN);
          setPreview({ q, items, mode, state: "searching" });
        } else if (msg.type === "error") setPreview({ q, items, mode, state: "error" });
      })
        .then((finished) => { if (!c.signal.aborted) setPreview({ q, items, mode, state: finished ? "done" : "error" }); })
        .catch((e) => { if (e.name !== "AbortError" && !c.signal.aborted) setPreview({ q, items, mode, state: "error" }); });
    }, PAUSE_MS);
    return () => clearTimeout(timer.current);
  }, [value]);

  useEffect(() => () => ctrl.current?.abort(), []);

  // Close on a click anywhere outside the bar and its preview.
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);

  // Opening a match counts as a lookup, like opening one from the results page:
  // the logo can return to where you were, and "Back to search results…" shows.
  const openMatch = (r) => {
    noteOrigin();
    try { sessionStorage.setItem(LAST_SEARCH_KEY, preview.q); } catch {}
    window.location.assign(verseHref(r));
  };

  const onKey = (e) => {
    const n = preview.items.length;
    if (e.key === "ArrowDown" && open && n) { e.preventDefault(); setPick((p) => (p + 1) % n); }
    else if (e.key === "ArrowUp" && open && n) { e.preventDefault(); setPick((p) => (p <= 0 ? n - 1 : p - 1)); }
    else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); }
    else if (e.key === "Enter" && open && pick >= 0 && preview.items[pick]) { e.preventDefault(); openMatch(preview.items[pick]); }
  };

  const showing = open && value.trim().length >= MIN_CHARS && preview.state !== "idle";
  let note = null;
  if (preview.state === "error") note = "Something went wrong with the search.";
  else if (preview.state === "done" && !preview.items.length) note = "No matching verses";
  else if (preview.state === "searching" && !preview.items.length) note = "Searching…";

  return (
    <form
      ref={root}
      action="/search"
      method="get"
      className={showing ? "search previewing" : "search"}
      role="search"
      onSubmit={noteOrigin}
    >
      <label htmlFor="q" className="sr">Search verses</label>
      <Magnifier />
      <input
        ref={input}
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search a verse or a word"
        autoComplete="off"
        spellCheck="false"
        maxLength={200}
        required
        role="combobox"
        aria-expanded={showing}
        aria-controls="search-preview"
        aria-activedescendant={showing && pick >= 0 ? `sp-${pick}` : undefined}
      />

      {showing && (
        <div className="search-preview" id="search-preview" role="listbox" aria-label="Top matches">
          {preview.items.map((r, i) => (
            <a
              key={`${r.slug}-${r.c}-${r.v}`}
              id={`sp-${i}`}
              role="option"
              aria-selected={i === pick}
              className={i === pick ? "sp-item on" : "sp-item"}
              href={verseHref(r)}
              onMouseMove={() => setPick(i)}
              onClick={(e) => { e.preventDefault(); openMatch(r); }}
            >
              <span className="sp-text">{r.text}</span>
              <span className="sp-where">
                {r.book} {r.c}:{r.v}
                {preview.mode !== "reference" && <span className="sp-score">{Math.round(r.score * 100)}% match</span>}
              </span>
            </a>
          ))}
          {note && <p className="sp-note">{note}</p>}
          {preview.items.length > 0 && (
            <button type="submit" className="sp-all">
              All results for “{preview.q}”
              {preview.state === "searching" && <span className="sp-live">still searching…</span>}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
