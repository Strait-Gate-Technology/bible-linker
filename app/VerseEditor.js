"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { noteParagraphs } from "./richText";
import { VERSE_OPEN_EVENT } from "./verseActions";
import InlineVerseSearch from "./InlineVerseSearch";
import VerseRefPreview from "./VerseRefPreview";
import RefAssist from "./RefAssist";
import { Underline, Strikethrough, FORMATS, NO_FORMAT, formatsAt } from "./formatTools";
import { linksFor, upsertLink, removeLink, newLinkId, plainText, refsIn, colorOf, chooseColor, chooseTilt, makeAnchor, versesOf, versesOfAnchor, formatVerses } from "./linkStore";

const GAP = 12;         // space between the popup's tail and the clicked line
const EDGE = 12;        // keep this far from the window's sides
const CLOSE_MS = 120;   // fade out time before the popup is removed
const MORPH_MS = 85;    // (+) → text editor, and the new (+) spawning in
const PLACEHOLDER = "Click on another verse or start typing...";
const SHOWN_REFS = 3;   // references listed under each collapsed entry
const TITLE_WORDS = 5;  // a folded note's bold title: its first words, as many of these as fit
const SUB_WORDS = 24;   // the line of subtext under it: the rest of that sentence, at most this many words

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// The verse goes inside “…”, so its own double quotes become single ones.
const nestQuotes = (s) => s.replace(/“/g, "‘").replace(/”/g, "’").replace(/"/g, "'");

// Editor.js is fetched as soon as a verse editor opens, so it's ready by the time
// the (+) is pressed.
const loadEditorJS = () => import("@richview/editorjs");

// Dims every verse but the given one(s) (same .focusing styles as search
// navigation), or lifts the dimming when given null.
function isolate(verses) {
  const reader = document.querySelector(".reader");
  if (!reader) return;
  reader.querySelectorAll(".w.hit").forEach((el) => el.classList.remove("hit"));
  window.dispatchEvent(new CustomEvent("bible-linker:isolate", { detail: { verses } }));
  if (verses === null) { reader.classList.remove("focusing"); return; }
  for (const v of [].concat(verses)) reader.querySelectorAll(`.w[data-v="${v}"]`).forEach((el) => el.classList.add("hit"));
  // The word by word reveal pins each word's opacity at 1 even after it finishes,
  // which would override the dimming. Retire it first (.instant: no animation, same
  // end state), commit that, and only then dim so the 85ms fade actually plays.
  if (!reader.classList.contains("instant")) {
    reader.classList.add("instant");
    void reader.offsetHeight;
  }
  reader.classList.add("focusing");
}

// A folded note's preview: its first five words in bold as a title, cut to what fits
// on one line and ending in "..." when the note goes on; below it, in smaller
// regular text, the words that follow, up to the end of that sentence (or about a
// sentence's worth). The subtext starts exactly where the title stopped, so no word
// is skipped when fewer than five fit.
const trimEnd = (s) => s.trimEnd().replace(/[\s,.;:!?—–-]+$/, "");

function NotePreview({ text }) {
  const title = useRef(null);
  const words = text.split(" ").filter(Boolean);
  const [used, setUsed] = useState(Math.min(TITLE_WORDS, words.length)); // words shown in the title

  useLayoutEffect(() => {
    const node = title.current;
    if (!node) return;
    const fit = () => {
      const max = Math.min(TITLE_WORDS, words.length);
      for (let k = max; k >= 1; k--) {
        const more = k < words.length;
        const head = words.slice(0, k).join(" ");
        node.textContent = more ? trimEnd(head) + "..." : head;
        if (node.scrollWidth <= node.clientWidth) { setUsed(k); return; }
      }
      // Not even one word fits: cut the first word itself.
      const w = words[0] ?? "";
      let lo = 0, hi = w.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        node.textContent = w.slice(0, mid) + "...";
        if (node.scrollWidth <= node.clientWidth) lo = mid; else hi = mid - 1;
      }
      node.textContent = w.slice(0, lo) + "...";
      setUsed(1);
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit); // the row narrows while "Are you sure?" shows
    ro.observe(node);
    return () => ro.disconnect();
  }, [text]);

  // The rest of the sentence after the title.
  const rest = words.slice(used);
  const sub = [];
  for (const w of rest) {
    sub.push(w);
    if (/[.!?]["'”’)\]]*$/.test(w) || sub.length >= SUB_WORDS) break;
  }
  const cutShort = sub.length < rest.length && !/[.!?]["'”’)\]]*$/.test(sub[sub.length - 1] ?? "");

  return (
    <>
      <span ref={title} className="ve-entry-title">{words.slice(0, TITLE_WORDS).join(" ")}</span>
      {sub.length > 0 && (
        <span className="ve-entry-sub">{cutShort ? trimEnd(sub.join(" ")) + "..." : sub.join(" ")}</span>
      )}
    </>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4.8h6V7" />
      <path d="M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
// The bin for throwing away the note being written: the same shape as TrashIcon,
// drawn a touch heavier to sit beside the check mark.
function DiscardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4.8h6V7" />
      <path d="M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

const isMac = () => typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? "");

// The status bar along the bottom of the note: B, I, U and S, lit when the text at
// the cursor has that format. Each is also a button that turns it on or off, the
// same as its shortcut. Pressing one keeps the cursor (and selection) in the note.
function FormatBar({ formats, onToggle }) {
  const mod = isMac() ? "Cmd" : "Ctrl";
  return (
    <div className="ve-format" role="toolbar" aria-label="Text formatting">
      {FORMATS.map((f) => (
        <button
          key={f.key}
          type="button"
          className={`ve-fmt ve-fmt-${f.key}${formats[f.key] ? " on" : ""}`}
          aria-pressed={formats[f.key]}
          aria-label={f.name}
          title={`${f.name} (${mod}+${f.shortcut})`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggle(f)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.5 5.5l3 3" />
      <path d="M4.5 19.5l1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5z" />
    </svg>
  );
}

// A VerseLink in the Verse Editor's list. Folded, it shows a bold title and a line
// of subtext (NotePreview) and a few of its VerseRefs; clicking it opens it out to
// show everything (every paragraph, with its formatting and its VerseRefs in place,
// and all of its references), and clicking again folds it back. On the right, side
// by side, a pencil edits it and a bin deletes it, folded or not. VerseRefs are real links here: resting on one shows
// its preview, clicking one goes to that verse. On the right, a bin turns into
// "Are you sure?" (in red) with a neutral check and cross: the check deletes, the
// cross keeps it.
function Entry({ link, expanded, onToggle, onEdit, onDelete, onGo, passage }) {
  const [asking, setAsking] = useState(false);
  const refs = link.refs ?? [];
  const shown = expanded ? refs : refs.slice(0, SHOWN_REFS);
  const paragraphs = expanded ? noteParagraphs(link.content) : null;
  const onClick = (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (a) {
      const href = a.getAttribute("href");
      if (href?.startsWith("/?ref=")) { e.preventDefault(); onGo(href); }
      return; // a web link opens in its own tab
    }
    onToggle(link);
  };
  return (
    <li className={["ve-row", asking ? "asking" : "", expanded ? "open" : ""].join(" ")}>
      <div
        className="ve-entry"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        style={{ "--hl": colorOf(link) }}
        onClick={onClick}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); onToggle(link); }
        }}
      >
        {passage && <span className="ve-entry-passage">{passage}</span>}
        {expanded ? (
          <div className="ve-entry-full">
            {paragraphs.length
              ? paragraphs.map((html, i) => <p key={i} dangerouslySetInnerHTML={{ __html: html }} />)
              : <p>(empty)</p>}
          </div>
        ) : (
          <NotePreview text={plainText(link.content) || "(empty)"} />
        )}
        {refs.length > 0 && (
          <span className="ve-entry-refs">
            {shown.map((r, i) => (
              <Fragment key={`${r.label}-${i}`}>
                {i > 0 && " · "}
                <a href={r.href}>{r.label}</a>
              </Fragment>
            ))}
            {refs.length > shown.length && ` +${refs.length - shown.length}`}
          </span>
        )}
      </div>
      <div className="ve-side">
        {!asking && (
          <button type="button" className="ve-pencil" aria-label="Edit this note" title="Edit this note" onClick={() => onEdit(link)}>
            <PencilIcon />
          </button>
        )}
        {asking ? (
          <span className="ve-confirm" role="group" aria-label="Delete this note?">
            <span className="ve-sure">Are you sure?</span>
            <button type="button" className="ve-yes" aria-label="Yes, delete it" onClick={() => onDelete(link)}><CheckIcon /></button>
            <button type="button" className="ve-no" aria-label="No, keep it" onClick={() => setAsking(false)}><CrossIcon /></button>
          </span>
        ) : (
          <button type="button" className="ve-trash" aria-label="Delete this note" onClick={() => setAsking(true)}><TrashIcon /></button>
        )}
      </div>
    </li>
  );
}

// The Verse Editor. Clicking a verse opens it above the click, with every other
// verse dimmed. Three states:
//   "open"       the verse's links (collapsed) and a (+) button
//   "editing"    the (+) has morphed into a rich text editor, with a fresh (+)
//                spawned below it; clicking another verse drops a reference to it
//                into the text instead of moving the editor
//   "collapsed"  after clicking away while editing: the dense list of links, (+) below
// Keys while editing: Shift+Enter saves the note and returns to the verse's list,
// popup still open (the same as the green check). Ctrl+Enter (Cmd+Enter on a Mac) saves the note and opens a new
// one straight away (or cancels an empty one); Escape discards the note being
// written. Either way the popup stays on the verse.
// Clicking a saved note in the list opens it out in full; its pencil edits it.
// Clicking away saves and collapses; clicking away from "open" or "collapsed" closes.
// Escape does the same as clicking away when the popup isn't in "editing" (which has
// its own Escape, above, for discarding the draft).
export default function VerseEditor({ book, slug, chapter }) {
  const [open, setOpen] = useState(null);      // { verse, word, fx, n }
  const [mode, setMode] = useState("open");    // open | editing | collapsed
  const [links, setLinks] = useState([]);      // this verse's saved links
  const [active, setActive] = useState(null);  // { id, created, content, morph, n }
  const [pos, setPos] = useState(null);        // { left, top, tail, below }
  const [closing, setClosing] = useState(false);
  const [inline, setInline] = useState(null);  // { rect } while the inline verse search is open
  const [expanded, setExpanded] = useState(null); // id of the saved note opened out in the list
  const [listEl, setListEl] = useState(null);     // the list, for its VerseRef previews
  const router = useRouter();

  const card = useRef(null);
  const slot = useRef(null);
  const holderHost = useRef(null);   // where Editor.js lives inside the slot, above the format bar
  const [formats, setFormats] = useState(NO_FORMAT);
  const [slotEl, setSlotEl] = useState(null); // the same element, as state, for the hover preview
  const editor = useRef(null);       // the live Editor.js instance
  const savedRange = useRef(null);   // caret inside the editor, kept while clicking verses
  const closeTimer = useRef(0);
  const busy = useRef(false);        // a save is under way
  const assistOpen = useRef(false);  // the typed reference helper is showing (it owns Esc/Enter/arrows then)
  const state = useRef({});          // latest values for window listeners
  state.current = { open, mode, active, inline, closing, expanded };

  // The current selection (one verse, or a Shift+click group) as an anchor.
  const anchorOf = (verses) => makeAnchor(slug, chapter, [].concat(verses));

  // ---------- saving ----------
  // Save whatever is in the editor (dropping the link if it's empty) and tear the
  // editor down. Resolves to { links: this verse's links as they now stand,
  // kept: whether the note had text and was saved }.
  const commit = async () => {
    const { open: o, active: a } = state.current;
    const ed = editor.current;
    editor.current = null;
    let kept = false;
    if (ed && a && o) {
      try {
        await ed.isReady;
        const content = await ed.save();
        if (plainText(content)) {
          // A new link gets its highlighter colour and tilt now; an existing one keeps its own.
          // A note keeps the verses it was made for; a new one takes the selection.
          const anchor = a.anchor ?? anchorOf(o.verses);
          const others = linksFor(anchor).filter((l) => l.id !== a.id);
          upsertLink({
            id: a.id, anchor, content, refs: refsIn(content), created: a.created,
            color: a.color ?? chooseColor(others), tilt: a.tilt ?? chooseTilt(),
          });
          kept = true;
        } else {
          removeLink(a.id);
        }
      } catch {}
    }
    return { links: o ? linksFor(anchorOf(o.verses)) : [], kept };
  };

  const freshNote = () => ({ id: newLinkId(), created: Date.now(), content: null, morph: true, n: Date.now() });

  const close = () => {
    isolate(null);
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(null); setPos(null); setActive(null); setMode("open"); setClosing(false);
    }, CLOSE_MS);
  };

  // Click away / Escape: editing collapses into the dense list (or closes if nothing
  // was kept); from "open" or "collapsed" it closes.
  const stepBack = async () => {
    if (busy.current) return;
    if (state.current.mode !== "editing") { close(); return; }
    busy.current = true;
    const { links: saved } = await commit();
    busy.current = false;
    setActive(null);
    setLinks(saved);
    if (saved.length) setMode("collapsed"); else close();
  };

  // Ctrl+Enter: save the note and, in the same motion, start a new one (it grows
  // out of the (+) like a click on it would), so writing can simply carry on;
  // Escape then drops that new, empty one. Ctrl+Enter on an empty note just
  // cancels it and returns to the verse's list. The popup stays open either way.
  const submit = async () => {
    if (busy.current) return;
    busy.current = true;
    const { links: saved, kept } = await commit();
    busy.current = false;
    setLinks(saved);
    if (kept) {
      setActive(freshNote());
      setMode("editing");
    } else {
      setActive(null);
      setMode("open");
    }
  };

  // Shift+Enter, and the green check under the note: save it and go back to the
  // verse's list, popup still open, with the (+) right there for another. An empty
  // note is simply dropped, as with Ctrl+Enter.
  const finish = async () => {
    if (busy.current) return;
    busy.current = true;
    const { links: saved } = await commit();
    busy.current = false;
    setActive(null);
    setLinks(saved);
    setMode("open");
  };

  // A VerseRef clicked in the list (or a verse in its preview): save any note being
  // written, put the popup away and go to that verse, which arrives the way a
  // search result does (glide down, the rest dimmed).
  const goTo = async (href) => {
    if (busy.current) return;
    if (state.current.mode === "editing") {
      busy.current = true;
      await commit();
      busy.current = false;
    }
    close();
    router.push(href);
  };

  const toggleExpanded = (link) => setExpanded((id) => (id === link.id ? null : link.id));

  // ---------- formatting ----------
  // Read the formats at the cursor into the status bar (only while it's in the note).
  const readFormats = () => {
    const f = formatsAt(slot.current);
    if (!f) return;
    setFormats((prev) => (FORMATS.every((x) => prev[x.key] === f[x.key]) ? prev : f));
  };

  // Turn a format on or off at the cursor or across the selection. If focus has
  // left the note, the cursor is put back where it was first.
  const toggleFormat = (f) => {
    const sel = window.getSelection();
    const live = sel?.rangeCount && slot.current?.contains(sel.getRangeAt(0).startContainer);
    if (!live) {
      const range = caretRange();
      if (!range) return;
      const host = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)
        ?.closest("[contenteditable='true']");
      host?.focus({ preventScroll: true });
      sel.removeAllRanges();
      sel.addRange(range);
    }
    document.execCommand(f.command);
    readFormats();
  };

  // Leaving the editor also closes an inline search left open.
  useEffect(() => { if (mode !== "editing") setInline(null); }, [mode, active?.id]);

  // Escape: throw the draft away (a new note is never saved; an existing one keeps
  // its last saved text) and return to the verse's list, popup still open.
  const discard = () => {
    if (busy.current) return;
    const { open: o } = state.current;
    editor.current = null; // the editor effect's cleanup tears the instance down
    setActive(null);
    setLinks(o ? linksFor(anchorOf(o.verses)) : []);
    setMode("open");
  };

  // Delete a link (after the entry's "Are you sure?"). The popup stays; an empty
  // collapsed list turns back into the open state with its "No links" notice.
  const deleteLink = (link) => {
    removeLink(link.id);
    setExpanded((id) => (id === link.id ? null : id));
    const { open: o } = state.current;
    const ls = o ? linksFor(anchorOf(o.verses)) : [];
    setLinks(ls);
    if (!ls.length && state.current.mode === "collapsed") setMode("open");
  };

  // Start writing: in a new link (from a (+) button) or an existing one.
  const startEditing = async (link) => {
    if (busy.current) return;
    busy.current = true;
    const saved = state.current.mode === "editing" ? (await commit()).links : links;
    busy.current = false;
    setLinks(saved);
    setExpanded(null);
    setActive(
      link
        ? { id: link.id, created: link.created, content: link.content, color: link.color, tilt: link.tilt, anchor: link.anchor, morph: false, n: Date.now() }
        : freshNote()
    );
    setMode("editing");
  };

  // ---------- VerseRefs ----------
  // A VerseRef is a link to one verse placed inline in a note: a plain <a> whose
  // href is that verse's address (/?ref=John%203&v=16), which Editor.js keeps as is.
  // It's drawn as a blue link and doesn't do anything yet. linkStore's refsIn()
  // collects them into the VerseLink's refs list when the note is saved.

  // The caret inside the editor (as last seen), or the end of the last paragraph.
  const caretRange = () => {
    const root = slot.current;
    if (!root) return null;
    const range = savedRange.current;
    if (range && root.contains(range.startContainer)) return range;
    const blocks = root.querySelectorAll(".ce-paragraph[contenteditable]");
    const last = blocks[blocks.length - 1];
    if (!last) return null;
    const end = document.createRange();
    end.selectNodeContents(last);
    end.collapse(false);
    return end;
  };

  // Put a VerseRef to { book, c, v } at the caret, with a space before it if it
  // would otherwise run into the previous word, and one after it. The long form
  // (withText) follows the VerseRef with the verse itself in parentheses and quotes,
  // as ordinary editable text: John 3:16 (“For God so loved the world…”)
  const insertRef = ({ book: b, c, v, text }, withText = false) => {
    const range = caretRange();
    if (!range) return;
    const host = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)
      ?.closest("[contenteditable='true']");
    host?.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const node = range.startContainer;
    const prev = node.nodeType === 3 ? node.textContent.slice(0, range.startOffset).slice(-1) : "";
    const lead = prev && !/\s/.test(prev) ? "&nbsp;" : "";
    const label = `${b} ${c}:${v}`;
    const href = `/?ref=${encodeURIComponent(`${b} ${c}`)}&amp;v=${v}`;
    const quote = withText && text ? `(“${escapeHtml(nestQuotes(text))}”)&nbsp;` : "";
    document.execCommand("insertHTML", false, `${lead}<a href="${href}">${label}</a>&nbsp;${quote}`);
  };

  // While editing, clicking another verse in the chapter puts a VerseRef to it at the caret.
  const insertReference = (verse) => insertRef({ book, c: chapter, v: verse });

  // Tab while writing: open the inline verse search at the caret.
  const openInlineSearch = () => {
    // Tab is pressed with the caret live in the note, so take it from the selection
    // itself (the remembered one can lag behind fast typing).
    const sel = window.getSelection();
    const live = sel?.rangeCount && slot.current?.contains(sel.getRangeAt(0).startContainer) ? sel.getRangeAt(0) : null;
    const range = live ? live.cloneRange() : caretRange();
    if (!range) return;
    savedRange.current = range.cloneRange();
    let r = range.getBoundingClientRect();
    if (!r.width && !r.height) {
      // An empty line has no caret box; use the line's own box instead.
      const el = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      const box = el.getBoundingClientRect();
      r = { left: box.left, bottom: box.bottom };
    }
    setInline({ rect: { left: r.left, bottom: r.bottom } });
  };

  // Close the inline search; refocus puts the caret back where it was in the note.
  const closeInlineSearch = (refocus) => {
    setInline(null);
    if (!refocus) return;
    const range = caretRange();
    if (!range) return;
    const host = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)
      ?.closest("[contenteditable='true']");
    host?.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const pickFromInline = (r, withText = false) => {
    setInline(null);
    insertRef({ book: r.book, c: r.c, v: r.v, text: r.text }, withText);
  };

  // ---------- opening ----------
  useEffect(() => {
    const onOpen = async (e) => {
      const { verse, word, clientX, noteId, add } = e.detail;
      const { open: o, mode: m, active: a } = state.current;

      // Writing a note: another verse becomes a (single verse) reference, not a new
      // editor, with or without Shift.
      if (o && m === "editing") {
        if (state.current.inline) setInline(null);
        const own = versesOfAnchor(a?.anchor ?? anchorOf(o.verses));
        if (!own.includes(Number(verse))) insertReference(verse);
        return;
      }

      // Shift+click with the editor already up: add this verse to the group, or take
      // it out if it's already in (the last one can't be removed). The popup moves to
      // the verse just clicked.
      let verses = [Number(verse)];
      if (add && o && !state.current.closing) {
        const cur = o.verses;
        verses = cur.includes(Number(verse))
          ? (cur.length > 1 ? cur.filter((v) => v !== Number(verse)) : cur)
          : [...cur, Number(verse)];
      }

      loadEditorJS().catch(() => {}); // warm up the editor's code in the background
      const r = word.getBoundingClientRect();
      const fx = r.width && clientX != null ? Math.min(1, Math.max(0, (clientX - r.left) / r.width)) : 0.5;
      clearTimeout(closeTimer.current);
      setClosing(false);
      const ls = linksFor(anchorOf(verses));
      setLinks(ls);
      // Opened from a highlight's bubble: that note comes up opened out in the list
      // (its pencil edits it).
      setExpanded(noteId && ls.some((l) => l.id === noteId) ? noteId : null);
      setActive(null);
      setMode("open");
      if (add) document.documentElement.classList.add("shift-held"); // opened by a Shift+click, Shift still down
      setOpen((prev) => ({ verses: [...verses].sort((x, y) => x - y), verse: Number(verse), word, fx, n: (prev?.n ?? 0) + 1 }));
      isolate(verses);
    };
    window.addEventListener(VERSE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VERSE_OPEN_EVENT, onOpen);
  }, [book, slug, chapter]);

  // ---------- click away / Escape ----------
  useEffect(() => {
    if (!open || closing) return;
    const onClick = (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t || !t.isConnected) return;                 // removed by the click itself (e.g. the (+))
      if (card.current?.contains(t)) return;             // inside the editor
      if (t.closest(".reader .w")) return;               // verses: handled by onOpen
      if (t.closest(".ct-popover, .ce-popover, .ce-inline-toolbar, .ce-conversion-toolbar")) return; // editor's own toolbars
      if (t.closest(".ve-inline-search, .vr-preview, .ref-assist")) return; // the inline search, a VerseRef preview, the reference helper
      stepBack();
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [open, closing]);

  // Escape from "open" or "collapsed": dismiss the popup, same as clicking away.
  // ("editing" has its own Escape below, which discards the draft instead of closing.)
  useEffect(() => {
    if (!open || closing || mode === "editing") return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (state.current.expanded) { setExpanded(null); return; } // fold an opened out note first
      stepBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closing, mode]);

  // Editing keys. Captured ahead of Editor.js, so Ctrl+Enter doesn't also start a
  // new paragraph and Escape doesn't only close one of its toolbars.
  useEffect(() => {
    if (!open || mode !== "editing") return;
    const onKey = (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest(".ve-inline-search")) return; // its own keys (Escape cancels just the search)
      if (assistOpen.current && e.key === "Escape") return; // Escape closes just the reference helper
      if (e.key === "Tab" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && t?.closest(".ve-slot")) {
        e.preventDefault(); e.stopPropagation();
        openInlineSearch();
      } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        discard();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); e.stopPropagation();
        submit();
      } else if (e.key === "Enter" && e.shiftKey && !e.altKey && !assistOpen.current) {
        // Shift+Enter: save and stop there, back to the verse's list with the popup
        // open (no new note). While the reference helper is showing, Shift+Enter
        // belongs to it (the reference with its verse text).
        e.preventDefault(); e.stopPropagation();
        finish();
      } else if ((e.ctrlKey || e.metaKey) && !e.altKey && t?.closest(".ve-slot")) {
        // Underline (Ctrl+U) and strikethrough (Ctrl+Shift+X). Bold and italic
        // (Ctrl+B, Ctrl+I) are Editor.js's own; the bar just catches up after them.
        const k = e.key.toLowerCase();
        const f = k === "u" && !e.shiftKey ? FORMATS[2] : k === "x" && e.shiftKey ? FORMATS[3] : null;
        if (f) { e.preventDefault(); e.stopPropagation(); toggleFormat(f); }
        else requestAnimationFrame(readFormats);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, mode]);

  // While Shift is held (and not writing), the popup fades back and lets clicks pass
  // through, so verses underneath it can be Shift+clicked into the group too.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const set = (on) => root.classList.toggle("shift-held", on);
    const down = (e) => { if (e.key === "Shift") set(true); };
    const up = (e) => { if (e.key === "Shift") set(false); };
    const off = () => set(false);
    // Shift may already be down when the popup appears (held across clicks), so
    // also take it from the pointer, which reports it on every move.
    const move = (e) => set(e.shiftKey);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("blur", off);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", move); window.removeEventListener("blur", off); off();
    };
  }, [open]);

  // Remember the caret whenever it's inside the editor, so a verse click (which
  // moves the selection into the chapter text) can put the reference back there.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (sel?.rangeCount && slot.current?.contains(sel.getRangeAt(0).startContainer)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
        readFormats();
      }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  // ---------- the rich text editor ----------
  // Each editing session gets its own holder element and Editor.js instance.
  useEffect(() => {
    if (mode !== "editing" || !active || !holderHost.current) return;
    let cancelled = false, instance = null;
    const holder = document.createElement("div");
    holder.className = "ve-holder";
    holderHost.current.appendChild(holder);
    savedRange.current = null;
    setFormats(NO_FORMAT);

    // Starting Editor.js briefly blocks the page, so when the slot is morphing out of
    // the (+) button, wait until those 85ms are over; the morph then runs smoothly.
    const wait = active.morph ? new Promise((res) => setTimeout(res, MORPH_MS + 15)) : Promise.resolve();

    Promise.all([loadEditorJS(), wait]).then(([{ default: EditorJS }]) => {
      if (cancelled) return;
      instance = new EditorJS({
        holder,
        placeholder: PLACEHOLDER,
        minHeight: 0,
        autofocus: false, // its own autofocus can scroll the page; focused below instead
        tools: { underline: Underline, strikethrough: Strikethrough },
        inlineToolbar: ["bold", "italic", "underline", "strikethrough", "link"],
        logLevel: "ERROR",
        data: active.content ?? undefined,
      });
      editor.current = instance;
      // Put the caret at the end of the note without scrolling the page.
      instance.isReady.then(() => {
        if (cancelled) return;
        const blocks = holder.querySelectorAll(".ce-paragraph[contenteditable='true']");
        const last = blocks[blocks.length - 1];
        if (!last) return;
        last.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(last);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      if (editor.current === instance) editor.current = null;
      const done = () => holder.remove();
      if (instance) instance.isReady.then(() => instance.destroy()).catch(() => {}).finally(done);
      else done();
    };
  }, [mode, active?.id, active?.n]);

  // The (+) → editor morph: the slot starts as the button's exact size and shape,
  // then eases to the editor's in 85ms (see .ve-slot in globals.css).
  useLayoutEffect(() => {
    const el = slot.current;
    if (mode !== "editing" || !active?.morph || !el) return;
    el.classList.add("as-button");
    void el.offsetWidth;
    el.classList.remove("as-button");
  }, [mode, active?.id, active?.n]);

  // ---------- placement ----------
  // Anchored just above the clicked point (the card grows upward from there), or
  // below the line if there isn't room above. Follows the word on reflow.
  useLayoutEffect(() => {
    if (!open || !card.current) return;
    const place = () => {
      const el = card.current;
      if (!el || !open.word.isConnected) return;
      const r = open.word.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight;
      const x = r.left + open.fx * r.width;
      const left = Math.min(window.innerWidth - EDGE - w, Math.max(EDGE, x - w / 2));
      const below = r.top < h + GAP + EDGE;
      setPos({
        left: left + window.scrollX,
        top: (below ? r.bottom + GAP : r.top - GAP) + window.scrollY,
        tail: Math.min(w - 18, Math.max(18, x - left)),
        below,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("reader-size", place);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("reader-size", place); };
  }, [open]);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  if (!open) return null;

  const others = mode === "editing" ? links.filter((l) => l.id !== active?.id) : links;
  // The passage shown at the top: the note being written's own verses, else the selection.
  const selection = open.verses ?? [Number(open.verse)];
  const headVerses = mode === "editing" && active?.anchor ? versesOfAnchor(active.anchor) : selection;
  const passage = `${book} ${chapter}:${formatVerses(headVerses)}`;
  const selKey = formatVerses(selection);
  const cls = [
    "verse-editor",
    pos?.below ? "below" : "above",
    pos ? "placed" : "",
    mode === "collapsed" ? "dense" : "",
    closing ? "closing" : "",
  ].join(" ");

  return createPortal(
    <div
      className={`ve-anchor ${pos?.below ? "below" : "above"}${mode !== "editing" ? " selecting" : ""}`}
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}
    >
      <div
        key={open.n}
        ref={card}
        className={cls}
        role="dialog"
        aria-label={`Verse editor, ${passage}`}
        style={pos ? { "--tail": `${pos.tail}px` } : undefined}
      >
        {headVerses.length > 1 && <p className="ve-passage">{passage}</p>}

        {others.length > 0 && (
          <ul className="ve-list" ref={setListEl}>
            {others.map((l) => (
              <Entry
                key={l.id}
                link={l}
                expanded={expanded === l.id}
                onToggle={toggleExpanded}
                onEdit={startEditing}
                onDelete={deleteLink}
                onGo={goTo}
                // a note on other verses than the selection says which ones
                passage={formatVerses(versesOf(l)) !== selKey ? `${chapter}:${formatVerses(versesOf(l))}` : null}
              />
            ))}
          </ul>
        )}

        {mode === "open" && others.length === 0 && (
          <p className="ve-empty">{selection.length > 1 ? "No links for this passage" : "No links for this verse"}</p>
        )}

        {mode === "editing" && active && (
          <div className="ve-edit" key={active.id}>
            <div
              ref={(el) => { slot.current = el; setSlotEl(el); }}
              className="ve-slot"
              aria-label="Link text"
              // VerseRefs are links in look only for now: clicking one does nothing.
              onClick={(e) => { if (e.target instanceof Element && e.target.closest('a[href^="/?ref="]')) e.preventDefault(); }}
            >
              <div ref={holderHost} className="ve-host" />
              <FormatBar formats={formats} onToggle={toggleFormat} />
            </div>
            {/* For the mouse: save (check) or throw away (bin) the note being written. */}
            <div className="ve-actions">
              <button
                type="button"
                className="ve-save"
                aria-label="Save this note"
                title="Save this note (Shift+Enter)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={finish}
              >
                <CheckIcon />
              </button>
              <button
                type="button"
                className="ve-discard"
                aria-label={active.anchor ? "Discard changes" : "Discard this note"}
                title={active.anchor ? "Discard changes (Esc)" : "Discard this note (Esc)"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={discard}
              >
                <DiscardIcon />
              </button>
            </div>
          </div>
        )}

        {(
          <button
            key={mode === "editing" ? `spawn-${active?.n}` : "add"}
            type="button"
            className={mode === "editing" ? "ve-add spawn" : "ve-add"}
            aria-label="Add a link"
            onClick={() => startEditing(null)}
          >
            <PlusIcon />
          </button>
        )}

        <span className="ve-tail" aria-hidden="true" />
      </div>
      {mode === "editing" && slotEl && <VerseRefPreview root={slotEl} onInsert={insertRef} />}
      {/* VerseRefs in the list: while writing, a verse clicked in the preview goes into
          the note as usual; otherwise it takes you to that verse. */}
      {listEl && <VerseRefPreview root={listEl} onInsert={mode === "editing" ? insertRef : undefined} onGo={goTo} />}
      {mode === "editing" && slotEl && <RefAssist root={slotEl} openRef={assistOpen} disabled={!!inline} />}
      {inline && mode === "editing" && (
        <InlineVerseSearch rect={inline.rect} onPick={pickFromInline} onCancel={closeInlineSearch} />
      )}
    </div>,
    document.body
  );
}
