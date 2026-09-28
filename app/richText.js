// Showing a saved VerseLink's text outside the editor (its expanded entry in the
// Verse Editor). Editor.js stores each paragraph as a little HTML; only the
// formatting a note can actually have is let through, so nothing else in stored
// data can end up on the page: bold, italic, underline, strikethrough, line breaks
// and links. VerseRefs keep their verse address; other links must be web links and
// open in a new tab. Anything else is unwrapped down to its text.

const KEEP = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "BR", "A"]);

function clean(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue;
    if (child.nodeType !== 1 || !KEEP.has(child.tagName)) {
      if (child.nodeType === 1) { clean(child); child.replaceWith(...child.childNodes); }
      else child.remove();
      continue;
    }
    const href = child.tagName === "A" ? child.getAttribute("href") ?? "" : null;
    for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
    if (href !== null) {
      if (href.startsWith("/?ref=")) child.setAttribute("href", href);
      else if (/^https?:\/\//i.test(href)) {
        child.setAttribute("href", href);
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      } else { child.replaceWith(...child.childNodes); continue; }
    }
    clean(child);
  }
}

// The note's paragraphs as safe HTML strings, one per block.
export function noteParagraphs(content) {
  return (content?.blocks ?? []).map((b) => {
    // A <template> parses without loading or running anything in it.
    const t = document.createElement("template");
    t.innerHTML = b.data?.text ?? "";
    clean(t.content);
    const out = document.createElement("div");
    out.append(t.content);
    return out.innerHTML;
  }).filter((html) => html.replace(/<br\s*\/?>|&nbsp;|\s/g, "") !== "");
}
