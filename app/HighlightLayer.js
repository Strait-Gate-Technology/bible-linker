"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { loadLinks, LINKS_CHANGED, colorOf, tiltOf, plainText, versesOf } from "./linkStore";
import { openVerse, VERSE_OPEN_EVENT } from "./verseActions";

const OPACITY = 0.3;     // how strongly highlights show (applied to each verse's strips as a group)
const DIMMED = 0.3;      // further multiplier while another verse is isolated
const LEAVE_MS = 400;    // grace once the pointer has left the highlight, its bubble and the way between them
const GAP = 6;           // space between a strip and its bubble
const SLACK = 10;        // the bubble counts as hovered this far outside its edges
const BUBBLE_CHARS = 90;
const EDGE = 12;

// Highlights every verse that has VerseLinks, one highlighter strip per link (and
// per line the verse runs across), in the link's colour and tilted by its own 0 to
// 2 degrees, so several links make a verse look heavily and variously highlighted.
//
// Overlaps: each verse's strips are drawn as solid colours, oldest first, so a newer
// strip fully covers an older one where they overlap, and only then is the whole
// group made translucent. The result: where strips overlap, only the most recent
// colour shows (no muddy mixing); where an older strip's edge sticks out from under
// a newer one, it keeps its own colour.
//
// The strips sit behind the text, so the pointer never touches them directly; on
// every mouse move the layer asks the browser which strip lies under the pointer
// (topmost first) and shows a bubble listing every link on that verse, newest
// first, with the one under the pointer marked; clicking one opens the Verse Editor
// with that note opened out. Its VerseRefs are links: clicking one goes to that verse.
// The list scrolls when a verse has many.
//
// Reaching the bubble: once it's up, the bubble, a margin around it and the strip of
// space between it and the highlighted line all count as "still here", so the
// pointer can travel up into it without it vanishing or switching to a verse it
// happens to cross. It stays for as long as the pointer is anywhere in that area,
// and goes LEAVE_MS after the pointer has left it (and the highlight).
export default function HighlightLayer({ slug, chapter }) {
  const layer = useRef(null);
  const [byVerse, setByVerse] = useState([]);   // [[verse, [links oldest first]]]
  const [lines, setLines] = useState({});       // verse → [{ left, top, width, height }]
  const [hit, setHit] = useState(null);         // Set of isolated verses, if any
  const [bubble, setBubble] = useState(null);   // { link, verse, x, top }
  const bubbleEl = useRef(null);
  const leave = useRef(0);

  // This chapter's links, grouped by verse.
  const readLinks = useCallback(() => {
    const groups = new Map();
    for (const l of loadLinks()) {
      if (l.anchor?.book !== slug || l.anchor?.chapter !== chapter) continue;
      for (const v of versesOf(l)) { // a group link highlights each of its verses
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v).push(l);
      }
    }
    for (const list of groups.values()) list.sort((a, b) => a.created - b.created);
    setByVerse([...groups.entries()].sort((a, b) => a[0] - b[0]));
  }, [slug, chapter]);

  useEffect(() => {
    readLinks();
    window.addEventListener(LINKS_CHANGED, readLinks);
    window.addEventListener("storage", readLinks); // another tab changed them
    return () => { window.removeEventListener(LINKS_CHANGED, readLinks); window.removeEventListener("storage", readLinks); };
  }, [readLinks]);

  // Measure each highlighted verse's line boxes, relative to the text column.
  const measure = useCallback(() => {
    const col = layer.current?.parentElement;
    if (!col) return;
    const base = col.getBoundingClientRect();
    const out = {};
    for (const [verse] of byVerse) {
      const segs = [];
      for (const w of col.querySelectorAll(`.w[data-v="${verse}"]`)) {
        for (const r of w.getClientRects()) {
          if (!r.width) continue;
          const seg = segs.find((s) => Math.abs(s.t - r.top) < r.height * 0.5);
          if (seg) { seg.l = Math.min(seg.l, r.left); seg.r = Math.max(seg.r, r.right); seg.b = Math.max(seg.b, r.bottom); seg.t = Math.min(seg.t, r.top); }
          else segs.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
        }
      }
      out[verse] = segs.map((s) => {
        const h = s.b - s.t;
        return { left: s.l - base.left - 2, width: s.r - s.l + 4, top: s.t - base.top + h * 0.1, height: h * 0.8 };
      });
    }
    setLines(out);
  }, [byVerse]);

  useLayoutEffect(() => {
    const col = layer.current?.parentElement;
    if (!col) return;
    let timer = 0, frame = 0;
    const soon = (ms = 0) => { clearTimeout(timer); cancelAnimationFrame(frame); timer = setTimeout(() => { frame = requestAnimationFrame(measure); }, ms); };
    measure();
    document.fonts?.ready.then(() => soon(60)); // after the font lands and lines are pinned
    // A hovered verse grows a little; re-measure once that has settled.
    const mo = new MutationObserver(() => soon(120));
    mo.observe(col, { subtree: true, attributes: true, attributeFilter: ["data-hot"] });
    const ro = new ResizeObserver(() => soon(30));
    ro.observe(col);
    const onSize = () => soon(160);
    window.addEventListener("reader-size", onSize);
    window.addEventListener("resize", onSize);
    return () => {
      clearTimeout(timer); cancelAnimationFrame(frame);
      mo.disconnect(); ro.disconnect();
      window.removeEventListener("reader-size", onSize);
      window.removeEventListener("resize", onSize);
    };
  }, [measure]);

  // Follow which verse the Verse Editor (or a search arrival) has isolated, so the
  // other verses' highlights dim along with their text.
  useEffect(() => {
    const reader = layer.current?.closest(".reader");
    if (!reader) return;
    const read = () => setHit(reader.classList.contains("focusing")
      ? new Set([...reader.querySelectorAll(".w.hit")].map((w) => Number(w.dataset.v)))
      : null);
    read();
    const mo = new MutationObserver(read);
    mo.observe(reader, { attributes: true, attributeFilter: ["class"] });
    const onIsolate = () => requestAnimationFrame(read);
    window.addEventListener("bible-linker:isolate", onIsolate);
    return () => { mo.disconnect(); window.removeEventListener("bible-linker:isolate", onIsolate); };
  }, []);

  // Which strip is under the pointer? Its bubble shows; leaving hides it after a beat.
  const bubbleNow = useRef(null);
  bubbleNow.current = bubble;
  useEffect(() => {
    const col = layer.current?.parentElement;
    if (!col) return;
    let frame = 0, last = null;
    const keep = () => clearTimeout(leave.current);
    const hideSoon = () => {
      if (!bubbleNow.current) return;
      clearTimeout(leave.current);
      leave.current = setTimeout(() => setBubble(null), LEAVE_MS);
    };
    // The bubble, a little around it, and the gap between it and its line.
    const inSafeArea = (x, y) => {
      const b = bubbleNow.current, el = bubbleEl.current;
      if (!b || !el) return false;
      const r = el.getBoundingClientRect();
      if (x >= r.left - SLACK && x <= r.right + SLACK && y >= r.top - SLACK && y <= r.bottom + SLACK) return true;
      if (x < r.left - SLACK || x > r.right + SLACK) return false;
      return r.bottom <= b.line.top ? y >= r.bottom && y <= b.line.top : y >= b.line.bottom && y <= r.top;
    };
    const check = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      if (document.querySelector(".verse-editor")) { setBubble(null); return; } // editor is up: no bubbles
      if (inSafeArea(e.clientX, e.clientY)) { keep(); return; }
      const overCol = col.contains(e.target instanceof Node ? e.target : null);
      const strip = overCol && document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains("hl-strip"));
      if (!strip) { hideSoon(); return; }
      keep();
      const id = strip.dataset.link, verse = Number(strip.dataset.v);
      setBubble((b) => {
        if (b?.verse === verse) return b.hoverId === id ? b : { ...b, hoverId: id };
        const r = strip.getBoundingClientRect();
        return { verse, hoverId: id, x: e.clientX, line: { top: r.top, bottom: r.bottom } };
      });
    };
    const onMove = (e) => { last = e; if (!frame) frame = requestAnimationFrame(check); };
    const onOut = (e) => { if (!e.relatedTarget) { last = null; hideSoon(); } }; // left the window
    const onScroll = () => setBubble(null);
    // A click on the text, or the Verse Editor opening, puts any bubble away at once
    // (the pointer may not move again to tell the layer).
    const hideNow = () => { clearTimeout(leave.current); setBubble(null); };
    col.addEventListener("mousedown", hideNow);
    window.addEventListener(VERSE_OPEN_EVENT, hideNow);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      col.removeEventListener("mousedown", hideNow);
      window.removeEventListener(VERSE_OPEN_EVENT, hideNow);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(leave.current);
    };
  }, []);

  // Place the bubble just above the strip, near the pointer, inside the window.
  const [bubblePos, setBubblePos] = useState(null);
  useLayoutEffect(() => {
    if (!bubble || !bubbleEl.current) { setBubblePos(null); return; }
    const w = bubbleEl.current.offsetWidth, h = bubbleEl.current.offsetHeight;
    const left = Math.min(window.innerWidth - EDGE - w, Math.max(EDGE, bubble.x - w / 2));
    const above = bubble.line.top - h - GAP >= EDGE;
    setBubblePos({ left: left + window.scrollX, top: (above ? bubble.line.top - h - GAP : bubble.line.bottom + GAP) + window.scrollY });
  }, [bubble]);

  const router = useRouter();
  // A VerseRef in the bubble: go to its verse (it arrives like a search result).
  const go = (href) => {
    clearTimeout(leave.current);
    setBubble(null);
    router.push(href);
  };

  const open = (link) => {
    if (!bubble) return;
    const word = layer.current?.parentElement?.querySelector(`.w[data-v="${bubble.verse}"]`);
    if (!word) return;
    setBubble(null);
    openVerse(String(bubble.verse), word, bubble.x, link.id);
  };

  // Every link on the hovered verse, newest first (the one whose colour shows on top).
  const bubbleLinks = bubble ? [...(byVerse.find(([v]) => v === bubble.verse)?.[1] ?? [])].reverse() : [];

  return (
    <>
      <div ref={layer} className="hl-layer" aria-hidden="true">
        {byVerse.map(([verse, links]) => (
          <div
            key={verse}
            className="hl-verse"
            style={{ opacity: hit && !hit.has(verse) ? OPACITY * DIMMED : OPACITY }}
          >
            {links.map((l) =>
              (lines[verse] ?? []).map((ln, i) => (
                <div
                  key={`${l.id}-${i}`}
                  className="hl-strip"
                  data-link={l.id}
                  data-v={verse}
                  style={{
                    left: ln.left, top: ln.top, width: ln.width, height: ln.height,
                    background: colorOf(l),
                    transform: `rotate(${tiltOf(l)}deg)`,
                  }}
                />
              ))
            )}
          </div>
        ))}
      </div>

      {bubble && bubbleLinks.length > 0 && createPortal(
        <div
          ref={bubbleEl}
          className="hl-bubble"
          role="listbox"
          aria-label={`Notes on verse ${bubble.verse}`}
          style={bubblePos ? { left: bubblePos.left, top: bubblePos.top } : { left: -9999, top: 0 }}
        >
          <p className="hl-bubble-head">
            {bubbleLinks.length === 1 ? "1 note" : `${bubbleLinks.length} notes`} on this verse
          </p>
          <div className="hl-bubble-list">
            {bubbleLinks.map((l) => {
              const text = plainText(l.content);
              const refs = l.refs ?? [];
              return (
                <div
                  key={l.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={l.id === bubble.hoverId}
                  className={l.id === bubble.hoverId ? "hl-item on" : "hl-item"}
                  style={{ "--hl": colorOf(l) }}
                  onClick={() => open(l)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(l); }}
                >
                  <span className="hl-bubble-text">
                    {text.length > BUBBLE_CHARS ? `${text.slice(0, BUBBLE_CHARS).replace(/\s+\S*$/, "")}...` : text}
                  </span>
                  {refs.length > 0 && (
                    <span className="hl-bubble-refs">
                      {refs.map((x, i) => (
                        <Fragment key={`${x.label}-${i}`}>
                          {i > 0 && " · "}
                          <a
                            href={x.href}
                            title={`Go to ${x.label}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(x.href); }}
                          >
                            {x.label}
                          </a>
                        </Fragment>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hl-bubble-hint">Click a note to open it · click a reference to go there</p>
        </div>,
        document.body
      )}
    </>
  );
}
