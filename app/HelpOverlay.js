"use client";

import { Fragment, useEffect, useRef, useState } from "react";

// A small mouse, for clicks.
function MouseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="4" y="1.5" width="8" height="13" rx="4" />
      <path d="M8 1.5v4.5M4 6h8" />
    </svg>
  );
}

// Keycaps: the key's symbol and its name, as printed on most keyboards
// (Esc and Ctrl carry just their names, as they do on the keys themselves).
const KEYS = {
  tab: ["⇥", "Tab"],
  shift: ["⇧", "Shift"],
  enter: ["↵", "Enter"],
  esc: ["", "Esc"],
  ctrl: ["", "Ctrl"],
  cmd: ["⌘", "Cmd"],
  up: ["↑", ""],
  down: ["↓", ""],
  left: ["←", ""],
  right: ["→", ""],
  question: ["?", ""],
  b: ["B", ""],
  i: ["I", ""],
  u: ["U", ""],
  x: ["X", ""],
  click: [<MouseIcon key="m" />, "Click"],
};

function Key({ k }) {
  const [symbol, name] = KEYS[k];
  return (
    <kbd className={name ? "key" : "key solo"}>
      {symbol && <span className="sym" aria-hidden={name ? "true" : undefined}>{symbol}</span>}
      {name && <span className="name">{name}</span>}
    </kbd>
  );
}

// One shortcut: groups of keys pressed together ("+"), alternatives separated by "or".
function Combo({ keys }) {
  return (
    <span className="combo">
      {keys.map((alt, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="or">or</span>}
          {alt.map((k, j) => (
            <Fragment key={j}>
              {j > 0 && <span className="plus">+</span>}
              <Key k={k} />
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

// Every shortcut, grouped by where it applies. "mod" becomes ⌘ Cmd on a Mac, ⌃ Ctrl elsewhere.
const SECTIONS = [
  {
    title: "Anywhere",
    rows: [
      [[["tab"]], "Jump to the search bar, ready to type."],
      [[["question"]], "Open this help. Press it again, or Esc, to close it."],
    ],
  },
  {
    title: "Reading a chapter",
    rows: [
      [[["left"], ["right"]], "Go to the previous or next chapter."],
      [[["click"]], "Click a verse to open its Verse Editor, where you can write notes about it."],
      [null, "Double click a verse that has no notes yet to start writing one straight away."],
      [[["shift", "click"]], "Add more verses to make one note about them all, next to each other or not. Shift+click a chosen verse again to leave it out."],
      [null, "Verses with notes are highlighted, one colour per note. Rest the pointer on a highlight to see all the notes on that verse. Move up into that list and it stays for as long as the pointer is there."],
      [[["click"]], "Click a note in that list to edit it, or a blue reference in it to go to that verse."],
    ],
  },
  {
    title: "Search bar",
    rows: [
      [null, "Start typing and pause for a moment to see the top three matches below the bar."],
      [[["down"], ["up"]], "Move through those matches."],
      [[["enter"]], "Open the chosen match, or see all results if none is chosen. A place like John 3, Jn 3:16, Jn 3:16-18 or Matthew 25:24,27,29 takes you straight there."],
      [[["esc"]], "Hide the matches."],
    ],
  },
  {
    title: "Go to menu (top right)",
    rows: [
      [[["click"]], "Pick a book, then a chapter, then a verse if you like. It stays open until you click outside it."],
      [[["esc"]], "Close the menu."],
    ],
  },
  {
    title: "Writing a note in the Verse Editor",
    rows: [
      [[["shift", "enter"]], "Save the note and stop there: you're back at the verse's notes with the editor still open."],
      [[["mod", "enter"]], "Save the note and start a new one straight away. On an empty note, this cancels it."],
      [[["esc"]], "Close whatever small window is open over the note (a search, a verse list, a preview, the colour wheel, the formatting toolbar), one per press. Once nothing is left, Esc throws away the note you're writing. Saved notes stay, and the editor stays open."],
      [[["click"]], "Click the green check under the note to save it (like Shift+Enter), or the red bin to throw it away (like Esc): a new note is dropped, and a note you were changing keeps its last saved text."],
      [[["click"]], "Click the coloured circle beside the check to pick a different highlight colour for the note. It's kept when the note is saved."],
      [[["mod", "b"], ["mod", "i"], ["mod", "u"], ["mod", "shift", "x"]], "Bold, italic, underline or strikethrough. The bar along the bottom of the note lights up B, I, U and S for the text at your cursor; click one there to switch it on or off."],
      [[["tab"]], "Search for a verse to reference, right where your cursor is."],
      [[["click"]], "Click another verse in the chapter to reference it at your cursor."],
      [null, "Type a reference by hand, like Jn 1:14 or Rev 12:1, and a list helps you find it: the book's chapters, then that chapter's verses."],
      [null, "Click outside the editor to save your note and fold the notes into a short list."],
      [[["click"]], "Click a saved note in the list to edit it."],
      [null, "Rest the pointer on a blue reference in the list to preview that verse; click a verse in the preview to go there."],
      [[["click"]], "Click the bin beside a note, then the check mark, to delete it (the cross keeps it)."],
    ],
  },
  {
    title: "Searching for a verse inside a note",
    rows: [
      [[["down"], ["up"]], "Move through the matches."],
      [[["enter"]], "Insert a reference to the chosen verse (or the top match)."],
      [[["shift", "enter"]], "Insert the reference followed by the verse itself, in quotes and parentheses."],
      [[["esc"]], "Cancel the search and go back to your note."],
    ],
  },
  {
    title: "Typing a reference in a note",
    rows: [
      [[["down"], ["up"]], "Move through the chapters or verses the list shows."],
      [[["enter"]], "Choose: a chapter fills in and moves on to its verses; a verse becomes a reference, written the way you typed it."],
      [[["shift", "enter"], ["tab"]], "On a verse: insert the reference followed by the verse itself, in quotes and parentheses. Shift+click does the same."],
      [[["esc"]], "Close the list and keep your text as it is."],
    ],
  },
  {
    title: "Verse references in a note (blue links)",
    rows: [
      [null, "Rest the pointer on a blue reference to see that verse and the ones around it."],
      [[["click"]], "Click a verse in that preview to reference it at your cursor."],
      [[["shift", "click"]], "Reference it and include its text in quotes and parentheses."],
    ],
  },
];

// The help screen: a modal over the whole page, opened with "?" (when not typing)
// or the "?" button in the bottom left corner; Esc, "?", the close button or a
// click on the backdrop closes it.
export default function HelpOverlay() {
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState("ctrl");
  const closeBtn = useRef(null);
  const opener = useRef(null);

  useEffect(() => {
    const p = navigator.userAgentData?.platform ?? navigator.platform ?? "";
    if (/mac|iphone|ipad/i.test(p)) setMod("cmd");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target instanceof Element ? e.target : null;
      const typing = t?.closest("input, textarea, select, [contenteditable='true']");
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && document.documentElement.dataset.help === "open") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // While open: mark the page (other shortcuts stand down), stop the page behind
  // from scrolling, and focus the close button; on close, return focus.
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      opener.current = document.activeElement;
      root.dataset.help = "open";
      root.style.overflow = "hidden";
      closeBtn.current?.focus({ preventScroll: true });
    } else {
      delete root.dataset.help;
      root.style.overflow = "";
      if (opener.current instanceof HTMLElement) opener.current.focus({ preventScroll: true });
    }
  }, [open]);

  const modKey = mod;

  return (
    <>
      <button type="button" className="help-button" aria-label="Help and keyboard shortcuts" onClick={() => setOpen(true)}>
        ?
      </button>

      {open && (
        <div className="help-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <header className="help-top">
              <h2 id="help-title">Help</h2>
              <p>Keys and clicks, and what they do where you are.</p>
              <button type="button" ref={closeBtn} className="help-close" aria-label="Close help" onClick={() => setOpen(false)}>
                <Key k="esc" />
              </button>
            </header>
            <div className="help-body">
              {SECTIONS.map((sec) => (
                <section key={sec.title}>
                  <h3>{sec.title}</h3>
                  <dl>
                    {sec.rows.map(([keys, text], i) => (
                      <div key={i} className="help-row">
                        <dt>{keys ? <Combo keys={keys.map((alt) => alt.map((k) => (k === "mod" ? modKey : k)))} /> : null}</dt>
                        <dd>{text}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
