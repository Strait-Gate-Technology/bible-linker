// Central place for what clicking a verse does. VerseFocus.js identifies the
// clicked verse and calls this; it hands the click to the Verse Editor
// (VerseEditor.js), which opens above the point that was clicked.
//
// verseNumber: the verse's number as a string (matches the word's data-v attribute).
// wordElement: the specific .w element that was clicked.
// event:       the click, for where on the word it landed.
export const VERSE_OPEN_EVENT = "bible-linker:verse-open";

// event.detail counts the clicks of a double click (2 on its second click).
export function onVerseClick(verseNumber, wordElement, event) {
  openVerse(verseNumber, wordElement, event?.clientX, undefined, !!event?.shiftKey, event?.detail || 1);
}

// Opens the Verse Editor on a verse; with editId, straight into editing that VerseLink.
// add (Shift+click): add the verse to the current group instead (or take it out).
export function openVerse(verseNumber, wordElement, clientX, editId, add = false, count = 1) {
  window.dispatchEvent(
    new CustomEvent(VERSE_OPEN_EVENT, { detail: { verse: verseNumber, word: wordElement, clientX, editId, add, count } })
  );
}
