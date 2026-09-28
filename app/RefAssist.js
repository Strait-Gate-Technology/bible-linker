"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveBook } from "../lib/books";

const PAUSE_MS = 100;
const EDGE = 12;

// A book (capitalised, optionally numbered: "Jn", "1 Cor", "Rev"), a space, then
// optionally a chapter, a colon and a verse, right before the caret.
const TOKEN = /(^|[\s("“'‘\u00a0])((?:[1-3][\s\u00a0]?)?[A-Z][A-Za-z]*\.?)[\s\u00a0]+(\d{1,3})?(?:(:)(\d{0,3}))?$/;

// Verses per chapter, fetched once per page.
const cache = new Map();
function chapterVerses(name, c) {
  const key = `${name} ${c}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`/api/verses?ref=${encodeURIComponent(key)}&all=1`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(key);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// The verse goes inside “…”, so its own double quotes become single ones.
const nestQuotes = (s) => s.replace(/“/g, "‘").replace(/”/g, "’").replace(/"/g, "'");

// What reference is being typed before the caret, if any.
function readToken(root) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return null;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== 3 || !root.contains(node)) return null;
  if (node.parentElement?.closest("a")) return null; // already inside a VerseRef
  const offset = sel.anchorOffset;
  const m = node.textContent.slice(0, offset).match(TOKEN);
  if (!m) return null;
  const book = resolveBook(m[2]);
  if (!book) return null;
  const start = offset - (m[0].length - m[1].length);
  return {
    node, start, end: offset,
    bookText: m[2].replace(/\u00a0/g, " "),
    book,
    chapter: m[3] ? Number(m[3]) : null,
    colon: !!m[4],
    verse: m[5] ? Number(m[5]) : null,
  };
}

// Helps write a verse reference by hand in a VerseLink. Typing a book name or its
// usual shorthand followed by a space ("Jn ") opens a list below the caret: that
// book's chapters; once a chapter is typed ("Jn 1"), that chapter's verses; with a
// verse ("Jn 1:14"), the list jumps to it. It follows as the reference is typed,
// shortened or changed. ↑/↓ move, Enter or a click picks: a chapter fills in
// "Jn 1:" and moves on to its verses; a verse turns what was typed into a VerseRef,
// labelled as written ("Jn 1:14") and pointing to that verse. Escape (or leaving
// the reference) closes it and leaves the text as it is. Shift+Enter, Tab (or Shift+click)
// on a verse does the same and adds the verse itself after the VerseRef, in
// parentheses and quotes, as the inline verse search does: Jn 1:14 (“The Word…”)
export default function RefAssist({ root, openRef, disabled }) {
  const [tok, setTok] = useState(null);
  const [verses, setVerses] = useState(null);   // for the chapter being typed, or null while loading
  const [pick, setPick] = useState(-1);
  const [pos, setPos] = useState(null);
  const box = useRef(null);
  const dismissed = useRef(null); // { node, start } of a reference Escape closed
  const tokRef = useRef(null);
  tokRef.current = tok;

  const stage = !tok ? null : tok.chapter == null ? "chapters" : "verses";
  const items = !tok ? [] :
    stage === "chapters"
      ? Array.from({ length: tok.book.chapters }, (_, i) => ({ c: i + 1 }))
      : tok.chapter > tok.book.chapters ? [] : (verses?.verses ?? []).map((r) => ({ c: tok.chapter, v: r.v, text: r.text }));

  // Follow the caret: re-read the reference being typed on every selection change.
  useEffect(() => {
    if (!root) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      if (disabled) { setTok(null); return; }
      const t = readToken(root);
      if (!t) { dismissed.current = null; setTok(null); return; }
      const d = dismissed.current;
      if (d && d.node === t.node && d.start === t.start) { setTok(null); return; }
      setTok((prev) => {
        const same = prev && prev.node === t.node && prev.start === t.start && prev.book === t.book && prev.chapter === t.chapter && prev.verse === t.verse && prev.end === t.end && prev.colon === t.colon;
        return same ? prev : t;
      });
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(read); };
    document.addEventListener("selectionchange", soon);
    root.addEventListener("input", soon);
    return () => { document.removeEventListener("selectionchange", soon); root.removeEventListener("input", soon); cancelAnimationFrame(frame); };
  }, [root, disabled]);

  // Verses for the chapter being typed (after the usual short pause).
  useEffect(() => {
    if (!tok || tok.chapter == null || tok.chapter > tok.book.chapters) { setVerses(null); return; }
    let live = true;
    const t = setTimeout(() => {
      chapterVerses(tok.book.name, tok.chapter).then((d) => { if (live) setVerses(d); });
    }, PAUSE_MS);
    return () => { live = false; clearTimeout(t); };
  }, [tok?.book, tok?.chapter]);

  // The typed chapter or verse is the highlighted choice; otherwise none.
  useEffect(() => {
    if (!tok) { setPick(-1); return; }
    if (stage === "chapters") setPick(-1);
    else setPick(tok.verse ? items.findIndex((it) => it.v === tok.verse) : -1);
  }, [tok, verses]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (pick < 0 || !box.current) return;
    box.current.querySelector(`[data-i="${pick}"]`)?.scrollIntoView({ block: "nearest" });
  }, [pick]);

  // Just below the caret.
  useLayoutEffect(() => {
    if (!tok || !box.current) { setPos(null); return; }
    const r = document.createRange();
    r.setStart(tok.node, tok.end);
    r.collapse(true);
    let rect = r.getBoundingClientRect();
    if (!rect.height) rect = tok.node.parentElement.getBoundingClientRect();
    const w = box.current.offsetWidth;
    const left = Math.min(window.innerWidth - EDGE - w, Math.max(EDGE, rect.left - 12));
    setPos({ left: left + window.scrollX, top: rect.bottom + 6 + window.scrollY });
  }, [tok]);

  useEffect(() => { openRef.current = !!tok && !disabled; }, [tok, disabled, openRef]);
  useEffect(() => () => { openRef.current = false; }, [openRef]);

  // Replace the typed reference (from its first letter to the caret).
  const replaceTyped = (t, html, isText) => {
    const range = document.createRange();
    range.setStart(t.node, t.start);
    range.setEnd(t.node, t.end);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand(isText ? "insertText" : "insertHTML", false, html);
  };

  const choose = useCallback((it, withText = false) => {
    const t = tokRef.current;
    if (!t || !it) return;
    if (it.v == null) {
      // A chapter: fill it in and carry on to its verses.
      replaceTyped(t, `${t.bookText} ${it.c}:`, true);
    } else {
      // A verse: the typed reference becomes a VerseRef, labelled as the user wrote it,
      // followed by the verse in parentheses and quotes for the long form.
      const href = `/?ref=${encodeURIComponent(`${t.book.name} ${it.c}`)}&amp;v=${it.v}`;
      const quote = withText && it.text ? `(“${esc(nestQuotes(it.text))}”)&nbsp;` : "";
      replaceTyped(t, `<a href="${href}">${esc(`${t.bookText} ${it.c}:${it.v}`)}</a>&nbsp;${quote}`, false);
    }
  }, []);

  // Keys while the list is showing. Captured before Editor.js and the Verse Editor.
  useEffect(() => {
    if (!tok || disabled) return;
    const onKey = (e) => {
      const n = items.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!n) return;
        e.preventDefault(); e.stopPropagation();
        setPick((p) => (e.key === "ArrowDown" ? (p + 1) % n : p <= 0 ? n - 1 : p - 1));
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Enter picks; Shift+Enter on a verse also brings its text along.
        if (!n) return;
        e.preventDefault(); e.stopPropagation();
        choose(items[pick >= 0 ? pick : 0], e.shiftKey);
      } else if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Tab does what Shift+Enter does: on a verse, the reference with its text.
        // (Held here even while the list is still loading, so focus never leaves the note.)
        e.preventDefault(); e.stopPropagation();
        if (n) choose(items[pick >= 0 ? pick : 0], true);
      } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        dismissed.current = { node: tok.node, start: tok.start };
        setTok(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tok, items, pick, disabled, choose]);

  if (!tok || disabled) return null;

  let head, note = null;
  if (stage === "chapters") head = `${tok.book.name}: choose a chapter`;
  else if (tok.chapter > tok.book.chapters) { head = tok.book.name; note = `${tok.book.name} has ${tok.book.chapters} chapter${tok.book.chapters === 1 ? "" : "s"}.`; }
  else { head = `${tok.book.name} ${tok.chapter}: choose a verse`; if (!verses) note = "Loading…"; }

  return createPortal(
    <div
      ref={box}
      className="ref-assist"
      role="listbox"
      aria-label={head}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
      onMouseDown={(e) => e.preventDefault()} // keep the caret in the note
    >
      <p className="ra-head">{head}</p>
      {note && <p className="ra-note">{note}</p>}
      {items.length > 0 && (
        <div className={stage === "chapters" ? "ra-list ra-chapters" : "ra-list"}>
          {items.map((it, i) => (
            <button
              type="button"
              key={it.v ?? it.c}
              data-i={i}
              role="option"
              aria-selected={i === pick}
              className={i === pick ? "ra-item on" : "ra-item"}
              onMouseMove={() => setPick(i)}
              onClick={(e) => choose(it, e.shiftKey)}
            >
              {it.v == null ? (
                <span className="ra-ch">{it.c}</span>
              ) : (
                <>
                  <span className="ra-text"><sup>{it.v}</sup>{it.text}</span>
                  <span className="ra-where">{tok.book.name} {it.c}:{it.v}</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
      <p className="ra-hint">
        {stage === "chapters" ? "↑ ↓ to move · Enter to choose · Esc to close" : "↑ ↓ to move · Enter to choose · Tab or Shift+Enter adds the verse · Esc to close"}
      </p>
    </div>,
    document.body
  );
}
