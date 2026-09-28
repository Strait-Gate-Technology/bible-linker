"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const OT_BOOKS = 39;
const RESIZE_MS = 85; // the panel eases to its new height between steps

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Toolbar "go to" picker: Book → Chapter → Verse (optional). Everything is click
// driven, nothing depends on hovering, and the panel stays open while you work
// inside it. It closes only on a click anywhere outside it, Escape, or a choice.
// A book's chapter list and a chapter's verse list each start with a shortcut
// straight past the rest of the picker: "Go to <Book>" jumps to chapter 1, "Open
// <Book> <Chapter>" jumps to that chapter, for anyone who already knows where
// they're headed and doesn't want to keep clicking through.
export default function Navigator({ books, current }) {
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState(null);   // index into books
  const [chapter, setChapter] = useState(null);
  const root = useRef(null);
  const trigger = useRef(null);
  const panel = useRef(null);
  const fromHeight = useRef(null);

  // Move to another step (Books, a book's chapters, a chapter's verses), noting the
  // panel's height first so the layout effect below can ease from it to the new one.
  const step = (nextBook, nextChapter) => {
    fromHeight.current = panel.current?.offsetHeight ?? null;
    setBook(nextBook);
    setChapter(nextChapter);
  };

  useLayoutEffect(() => {
    const el = panel.current, from = fromHeight.current;
    fromHeight.current = null;
    if (!el || from === null) return;
    el.style.transition = "none";
    el.style.height = "auto";
    const to = el.offsetHeight; // natural height of the new step (capped by max-height)
    if (Math.abs(to - from) < 1) { el.style.height = ""; el.style.transition = ""; return; }
    el.style.height = `${from}px`;
    void el.offsetHeight; // commit the starting height before transitioning
    el.style.transition = `height ${RESIZE_MS}ms ease-out`;
    el.style.height = `${to}px`;
    const done = () => { el.style.height = ""; el.style.transition = ""; };
    const t = setTimeout(done, RESIZE_MS + 30);
    return () => { clearTimeout(t); done(); };
  }, [book, chapter]);

  const currentBook = current ? books.findIndex((b) => current.startsWith(b.name + " ")) : -1;
  const currentChapter = currentBook >= 0 ? Number(current.slice(books[currentBook].name.length + 1)) : null;

  const close = (refocus) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!root.current?.contains(e.target)) close(false); };
    const esc = (e) => { if (e.key === "Escape") close(true); };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // The wheel over the panel scrolls only the panel's list, never the page behind it;
  // otherwise the page (and the panel with its header) would slide out of view.
  useEffect(() => {
    if (!open || !panel.current) return;
    const el = panel.current;
    const wheel = (e) => {
      e.preventDefault();
      const body = el.querySelector(".nav-body");
      if (body) body.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [open]);

  // Each step starts scrolled to the top.
  useEffect(() => {
    if (!open || !panel.current) return;
    panel.current.querySelector(".nav-body").scrollTop = 0;
  }, [open, book, chapter]);

  const toggle = () => {
    if (!open) { setBook(null); setChapter(null); }
    setOpen(!open);
  };

  const go = (b, c, v) => {
    const ref = encodeURIComponent(`${books[b].name} ${c}`);
    window.location.assign(v ? `/?ref=${ref}&v=${v}` : `/?ref=${ref}`);
  };

  const b = book !== null ? books[book] : null;

  return (
    <div className="nav" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="nav-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <span>{current ?? "Go to…"}</span>
        <Chevron />
      </button>

      {open && (
        <div className="nav-panel" role="dialog" aria-label="Go to a book, chapter or verse" ref={panel}>
          <div className="nav-crumbs">
            <button type="button" className={book === null ? "on" : ""} onClick={() => step(null, null)}>
              Books
            </button>
            {b && (
              <>
                <span aria-hidden="true">›</span>
                <button type="button" className={chapter === null ? "on" : ""} onClick={() => step(book, null)}>
                  {b.name}
                </button>
              </>
            )}
            {b && chapter !== null && (
              <>
                <span aria-hidden="true">›</span>
                <button type="button" className="on">{chapter}</button>
              </>
            )}
          </div>

          <div className="nav-body">
            {book === null && (
              <>
                {[["Old Testament", 0, OT_BOOKS], ["New Testament", OT_BOOKS, books.length]].map(([label, from, to]) => (
                  <section key={label}>
                    <h3>{label}</h3>
                    <div className="nav-books">
                      {books.slice(from, to).map((x, i) => (
                        <button
                          type="button"
                          key={x.slug}
                          className={from + i === currentBook ? "current" : ""}
                          onClick={() => step(from + i, null)}
                        >
                          {x.name}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </>
            )}

            {b && chapter === null && (
              <>
                <button type="button" className="nav-open" onClick={() => go(book, 1)}>
                  Go to {b.name}
                </button>
                <h3>Chapter</h3>
                <div className="nav-grid">
                  {b.verses.map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      className={book === currentBook && i + 1 === currentChapter ? "current" : ""}
                      onClick={() => step(book, i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}

            {b && chapter !== null && (
              <>
                <button type="button" className="nav-open" onClick={() => go(book, chapter)}>
                  Open {b.name} {chapter}
                </button>
                <h3>Or a verse</h3>
                <div className="nav-grid">
                  {Array.from({ length: b.verses[chapter - 1] }, (_, i) => (
                    <button type="button" key={i} onClick={() => go(book, chapter, i + 1)}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
