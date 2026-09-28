"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const LEAVE_MS = 160; // grace period to move the pointer between the link and the preview
const EDGE = 12;

// Verses fetched once per page, keyed by "John 3|16"; `ready` holds finished replies
// so a warmed preview renders on its first frame.
const cache = new Map();
const ready = new Map();
function loadVerses(ref, v) {
  const key = `${ref}|${v}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`/api/verses?ref=${encodeURIComponent(ref)}&v=${v}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => { ready.set(key, d ?? { error: true }); return d; }));
  }
  return cache.get(key);
}

// Where a VerseRef points: { ref: "John 3", v: 16 }, or null for other links.
export function verseRefTarget(a) {
  try {
    const url = new URL(a.getAttribute("href"), window.location.origin);
    const ref = url.searchParams.get("ref"), v = Number(url.searchParams.get("v"));
    return url.pathname === "/" && ref && v ? { ref, v } : null;
  } catch {
    return null;
  }
}

// A quick look at a VerseRef: hovering one in the note shows, within 85ms, its
// verse with a couple either side. It stays while the pointer is on the link or on
// the preview itself. Clicking a verse in it puts a VerseRef to that verse at the
// note's cursor; Shift+click puts the VerseRef followed by the verse's text.
// Where there's no note being written (a saved note's entry in the Verse Editor),
// it's given onGo instead of onInsert, and clicking a verse goes to it.
// Deliberately small: a way to check a verse, not a reader.
export default function VerseRefPreview({ root, onInsert, onGo }) {
  const [hover, setHover] = useState(null);  // { a, ref, v, n }
  const [data, setData] = useState(null);    // the /api/verses reply for it
  const [pos, setPos] = useState(null);
  const box = useRef(null);
  const leave = useRef(0);

  // Watch the note for the pointer entering and leaving VerseRefs.
  useEffect(() => {
    if (!root) return;
    const over = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href^="/?ref="]') : null;
      if (!a || !root.contains(a)) return;
      const t = verseRefTarget(a);
      if (!t) return;
      clearTimeout(leave.current);
      setHover((h) => (h?.a === a ? h : { a, ...t, n: Date.now() }));
    };
    const out = (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href^="/?ref="]') : null;
      if (!a) return;
      const to = e.relatedTarget;
      if (to instanceof Node && (a.contains(to) || box.current?.contains(to))) return;
      clearTimeout(leave.current);
      leave.current = setTimeout(() => setHover(null), LEAVE_MS);
    };
    // As soon as the pointer comes into the note, fetch every VerseRef's verses, so
    // resting on one shows its preview at once instead of waiting on the network.
    const warm = () => root.querySelectorAll('a[href^="/?ref="]').forEach((el) => {
      const t = verseRefTarget(el);
      if (t) loadVerses(t.ref, t.v);
    });
    root.addEventListener("mouseenter", warm);
    root.addEventListener("mouseover", over);
    root.addEventListener("mouseout", out);
    return () => {
      root.removeEventListener("mouseenter", warm);
      root.removeEventListener("mouseover", over);
      root.removeEventListener("mouseout", out);
      clearTimeout(leave.current);
    };
  }, [root]);

  // Fetch the verses for whatever is hovered.
  useEffect(() => {
    if (!hover) { setData(null); return; }
    let live = true;
    const key = `${hover.ref}|${hover.v}`;
    if (ready.has(key)) { setData(ready.get(key)); return; }
    setData(null);
    loadVerses(hover.ref, hover.v).then((d) => { if (live) setData(d ?? { error: true }); });
    return () => { live = false; };
  }, [hover?.ref, hover?.v, hover?.n]);

  // Just below the link, kept inside the window.
  useLayoutEffect(() => {
    if (!hover || !box.current) { setPos(null); return; }
    const r = hover.a.getBoundingClientRect();
    const w = box.current.offsetWidth;
    const left = Math.min(window.innerWidth - EDGE - w, Math.max(EDGE, r.left));
    setPos({ left: left + window.scrollX, top: r.bottom + 6 + window.scrollY });
  }, [hover]);

  if (!hover) return null;

  const pick = (e, r) => {
    e.preventDefault();
    if (onInsert) onInsert({ book: data.book, c: data.chapter, v: r.v, text: r.text }, e.shiftKey);
    else { setHover(null); onGo?.(`/?ref=${encodeURIComponent(`${data.book} ${data.chapter}`)}&v=${r.v}`); }
  };

  return createPortal(
    <div
      ref={box}
      className="vr-preview"
      role="tooltip"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
      onMouseEnter={() => clearTimeout(leave.current)}
      onMouseLeave={(e) => {
        if (e.relatedTarget instanceof Node && hover.a.contains(e.relatedTarget)) return;
        clearTimeout(leave.current);
        leave.current = setTimeout(() => setHover(null), LEAVE_MS);
      }}
      // Keep the note's caret where it is while clicking in here.
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className="vr-head">{hover.ref}:{hover.v}</p>
      {!data && <p className="vr-note">Loading…</p>}
      {data?.error && <p className="vr-note">Couldn't find this verse.</p>}
      {data?.verses && (
        <div className="vr-verses">
          {data.verses.map((r) => (
            <button
              type="button"
              key={r.v}
              className={r.v === data.focus ? "vr-verse focus" : "vr-verse"}
              onClick={(e) => pick(e, r)}
              title={onInsert ? `Insert ${data.book} ${data.chapter}:${r.v} (Shift+click to include its text)` : `Go to ${data.book} ${data.chapter}:${r.v}`}
            >
              <sup>{r.v}</sup>{r.text}
            </button>
          ))}
        </div>
      )}
      <p className="vr-hint">{onInsert ? "Click a verse to reference it · Shift+click to include its text" : "Click a verse to go there"}</p>
    </div>,
    document.body
  );
}
