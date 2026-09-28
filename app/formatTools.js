// Text formatting in a VerseLink: bold and italic come with Editor.js; underline and
// strikethrough are added here as small inline tools. Registering them also tells
// Editor.js to keep <u> and <s>/<strike> when a note is saved (anything an enabled
// inline tool doesn't claim is stripped out).

// One inline tool around a browser formatting command, like Editor.js's own bold.
function commandTool({ command, title, icon, tags }) {
  return class {
    static get isInline() { return true; }
    static get title() { return title; }
    static get sanitize() { return Object.fromEntries(tags.map((t) => [t, {}])); }

    constructor({ api }) {
      this.api = api;
      this.button = null;
    }

    render() {
      const b = document.createElement("button");
      b.type = "button";
      b.classList.add(this.api.styles.inlineToolButton);
      b.innerHTML = icon;
      this.button = b;
      return b;
    }

    surround() {
      document.execCommand(command);
    }

    checkState() {
      const on = document.queryCommandState(command);
      this.button?.classList.toggle(this.api.styles.inlineToolButtonActive, on);
      return on;
    }
  };
}

const svg = (body) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const Underline = commandTool({
  command: "underline",
  title: "Underline",
  tags: ["u"],
  icon: svg('<path d="M7 5v6a5 5 0 0 0 10 0V5"/><path d="M6 19h12"/>'),
});

export const Strikethrough = commandTool({
  command: "strikeThrough",
  title: "Strikethrough",
  tags: ["s", "strike", "del"],
  icon: svg('<path d="M16 7.5C15.4 6 13.9 5 12 5c-2.4 0-4 1.3-4 3.1 0 1.2.7 2 2 2.6"/><path d="M5 12h14"/><path d="M8 16.5c.6 1.5 2.1 2.5 4 2.5 2.4 0 4-1.3 4-3.2 0-.6-.2-1.2-.5-1.6"/>'),
});

// The four formats shown in the editor's status bar, in order.
export const FORMATS = [
  { key: "bold", label: "B", name: "Bold", command: "bold", tags: ["B", "STRONG"], shortcut: "B" },
  { key: "italic", label: "I", name: "Italic", command: "italic", tags: ["I", "EM"], shortcut: "I" },
  { key: "underline", label: "U", name: "Underline", command: "underline", tags: ["U"], shortcut: "U" },
  { key: "strike", label: "S", name: "Strikethrough", command: "strikeThrough", tags: ["S", "STRIKE", "DEL"], shortcut: "Shift+X" },
];

export const NO_FORMAT = { bold: false, italic: false, underline: false, strike: false };

// Which formats apply at the caret (or at the start of a selection) inside root.
// With a bare caret the browser's own state is used, since it knows about pending
// styles too: after Ctrl+B with nothing selected the next letters will be bold, so B
// shows as on. A selection, and underline inside a link, are read from the tags
// around it instead, so a VerseRef's link underline doesn't count as underlined.
export function formatsAt(root) {
  const sel = window.getSelection();
  if (!root || !sel?.rangeCount) return null;
  const node = sel.getRangeAt(0).startContainer;
  if (!root.contains(node)) return null;
  const inside = new Set();
  for (let el = node.nodeType === 1 ? node : node.parentElement; el && el !== root; el = el.parentElement) {
    inside.add(el.tagName);
  }
  const out = {};
  for (const f of FORMATS) {
    const tagged = f.tags.some((t) => inside.has(t));
    let on = tagged;
    if (sel.isCollapsed && !(f.key === "underline" && inside.has("A"))) {
      try { on = document.queryCommandState(f.command); } catch {}
    }
    out[f.key] = on;
  }
  return out;
}
