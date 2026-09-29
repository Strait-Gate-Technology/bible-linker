# Bible Linker 📚

A quiet Bible reader built with Next.js. Opens on John 1 and reveals it word by word.

## Run it
```bash
npm install
npm run dev        # http://localhost:3000
# or: npm run build && npm start
```

## Go to another chapter
Use the go to navigator at the top right (Book → Chapter → Verse), the ← and → keys, search for a reference such as `Psalms 23` or `1 cor 13`, or open `/?ref=Romans 8` directly.

## How it works
- **Bible text:** three public domain versions, each stored in its own folder under `app-data/bible/` (one JSON file per book) and read from disk by the server. Nothing is fetched at runtime.
- **Font:** Roboto Variable by default, with four alternatives in the font picker. All come from `@fontsource-variable/*` npm packages (the same files the fontsource CDN serves), bundled and served from the app itself; no Google Fonts. All are variable, so the hover weight can animate smoothly.
- **Reveal:** every word is a span with `animation-delay = index × step`. Total reveal ≈ 4.2 s for a chapter. It is pure CSS, so clicking or scrolling never interrupts it.
- **Size:** 16pt by default (`--reader-size` in `app/globals.css`). The toolbar's (−) and (+) buttons either side of the size value step it by 1pt within 12 to 48pt, live, and remember your choice (`app/SizeStepper.js`).
- **Width:** the reading column is 990px by default, shrinking to fit narrower windows.
- **Re-import text:** `npm run import-bible` re-downloads and converts all three versions (`npm run import-versions` redoes just KJV and BBE).

## Verse highlight
Text stays a static size. Hover a verse (cursor becomes a pointer) and every word of it eases (85ms) to a fixed 0.1pt larger, one weight step up from the default (Light 300 → Regular 400, not full bold), a dotted underline fading in, and a touch brighter; leaving eases it back over the same 85ms, with no grace period. Tune the transition time or the underline/weight values via the `.w[data-hot]` rule in `app/globals.css`, and the leave grace period (`LEAVE_DELAY_MS`) in `app/VerseFocus.js`.

The growth amount is fixed at 0.1pt (`--grow-pt` in `app/globals.css`) and is no longer adjustable from the toolbar.


## Column width
A thin white bar runs down the right edge of the text. Hover it for a left-right resize cursor; drag it right to widen the reading column, left to narrow it — the bar tracks the pointer 1:1. Text reflows live while dragging and its line breaks are re-pinned the moment you let go. The width you land on is remembered (`app/ColumnResize.js`), independent of the text size and hover growth controls. Limits are `MIN_W` and the `maxW()` cap in that file.

Line-break freezing is now shared in `app/textFreeze.js`, used by both the verse hover highlight and the width handle.


## Column margin
`--edge-margin` (`app/globals.css`, currently a fixed 2rem) is reserved as right-padding on the text column, so a hovered verse growing by 0.1pt never reaches the width-resize bar. It's a fixed estimate for now rather than computed from the actual maximum growth.

## Reset button
The clock-with-arrow button, just right of the version picker, clears every saved preference (text size, font, alignment, column width, Bible version) back to its default and re-measures line breaks. Hovering it shows a small "Reset all settings" tooltip. See `app/ResetButton.js`; it fires a `bible-linker:reset` event that `SizeStepper`, `FontSelect` and `AlignToggle` each listen for to sync their own display. If a version other than WEB was chosen, it also clears that and reloads.

## Animation speed
The hover grow/shrink duration is fixed at 85ms and is no longer adjustable from the toolbar. It lives in `--hover-ms` in `app/globals.css`, which the `.w` transition uses.

The toolbar wraps onto a second line on narrower windows instead of squeezing the "Bible Linker" title.


## Bible version
A picker at the left end of the toolbar, just left of the reset button, switches between three public domain versions:

| Picker | Version | Folder |
|---|---|---|
| WEB | World English Bible (default) | `app-data/bible/web/` |
| KJV | King James Version (1769) | `app-data/bible/kjv/` |
| BBE | Bible in Basic English (1965) | `app-data/bible/bbe/` |

The BBE is a dynamic equivalent translation: it renders meaning in plain modern English using a limited core vocabulary, so it reads very differently from the word for word KJV. A few passages the BBE translators left untranslated are marked `***` in the source and shown here as an ellipsis.

The choice is stored in a cookie (`bible-linker-version`) so the server renders the right text immediately; changing it reloads the page, replaying the reveal in the new version. The credit line under each chapter names the version shown. See `app/VersionSelect.js` and `lib/versions.js`.

KJV and BBE come from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) as plain verse lists with no paragraph data, so `scripts/import-versions.mjs` lays each chapter out using the WEB's paragraphs and poetry lines, placing every verse where the same verse sits in the WEB. Where the WEB splits one verse over several poetry lines, the other versions keep that verse on a single line.

## Font
A dropdown beside the text size buttons picks the reading font; it applies to the chapter text only, not the toolbar. Roboto is the default, then Literata (serif, built for long form reading), Crimson Pro (serif, Garamond style), Source Sans 3 (sans serif), and Noto Serif. The choice drives `--reader-font`, is saved like the other settings, and line breaks are re-pinned once the new face has loaded. See `app/FontSelect.js`.

## Verse search
The search bar at the top of every page (`app/SearchBox.js`) goes to `/search?q=…`. The query decides the method:

- **A verse reference** such as `John 3:16`, `1 cor 13:4-7` or `Psalm 23` returns exactly those verses.
- **One or two words** are matched word by word with **Jaro-Winkler** similarity. Each query word takes its best match among the verse's words and must score at least 0.9 (`JW_MIN`); the verse's score is the average. This forgives typos and catches word forms (`shepard` finds shepherd, `love` finds loved and loveth).
- **Three or more words** are matched as a phrase with **Levenshtein** distance: the fewest letter edits that turn the query into some stretch of the verse, scored as 1 minus edits over query length, with a floor of 0.75 (`LEV_MIN`).

Punctuation, case and apostrophes are ignored in both. The algorithms live in `lib/search.js`.

Results stream in. `app/api/search/route.js` searches one book at a time in the selected version and sends each book's matches the moment they're found, as newline separated JSON. `app/SearchResults.js` reads the stream and inserts every match straight into its ranked position, so verses appear on the page while the rest of the Bible is still being searched. Ranking is by score, highest first, with ties kept in Bible order. Each entry shows the verse text large, in your chosen font and size, with its reference and match percentage underneath; clicking it opens the chapter scrolled to that verse, whose number is marked. Only the best 250 are kept on the page (`SHOWN`); the total count is always shown.

## Going straight to a place
Typing a Bible location into the search bar and pressing Enter goes straight there instead of to a results page. With verses, they're revealed on arrival (glide down, the rest dimmed) just as when opening a search result: `John 3:16`, `Jn 3:16-18` (a range), `Matthew 25:24,27,29` (a list) or any mix. A bare chapter such as `Matthew 25` simply opens that chapter. The address carries the verses compactly (`/?ref=John%203&v=16-18`). See `app/search/page.js` and `parseReference` in `lib/bible.js`.

## Book names and shorthand
Books can be written in full or with their usual abbreviations, everywhere a reference is read: Jn, Rev, Gen, Ps, Is, 1 Cor, 1Cor, Phil, Phm, Song, and so on (the full table is in `lib/books.js`, with each book's chapter count). An unambiguous start of a name of three letters or more also works (Hebr, Deuter). Abbreviations that clash are settled the conventional way: Jon is Jonah, Jn or Joh is John.

## Search preview
As you type in the search bar, once there are at least two characters and the typing pauses for 100ms, the bar searches what's there so far and shows the top three matches in a dropdown just below it: the full verse text, then its reference with the match percentage in smaller text. It uses the same API, the same algorithms (Jaro-Winkler for one or two words, Levenshtein for more, references matched directly) and the same ranking as the results page, and refines while the rest of the Bible is searched; each new pause cancels the previous search. ↑/↓ pick a match and Enter opens it (Enter with nothing picked goes to the full results page, as does "All results for…" at the bottom). Escape or a click outside hides it. Opening a match counts as a lookup: the logo returns to where you were and "Back to search results…" appears. See `app/SearchBox.js` and `app/searchStream.js`.

## Opening a verse from search
Search result links carry the verse (`/?ref=John 15&v=12`). When `v` is present the chapter renders instantly with no word by word reveal (`.instant`), and `app/SearchArrival.js` runs the arrival: the page starts at the top, pauses briefly, then glides down (ease in out, 300 to 700ms depending on distance) until the verse sits about a third of the way down the screen. Only then is `.focusing` added, fading everything but that verse (other verses, heading, footer) to 30% opacity (70% transparent) in 85ms, with the verse number lit. The first click anywhere fades the rest back in over 450ms and drops `v` from the address. Scrolling or pressing a key during the glide stops it where it is and dims straight away. With reduced motion turned on in the OS, it jumps instead of gliding.

Once a search has been run in a tab, chapter pages show "Back to search results…" in the top left, under the title, returning to the most recent search (`app/BackToResults.js`).

## Ending a lookup: the Bible Linker logo
Submitting the first search of a lookup notes the chapter being read (`bible-linker:pre-search` in `sessionStorage`); later searches, from the results or from result chapters, keep that original. Clicking the Bible Linker logo returns to that chapter and ends the lookup, clearing the saved search term, its cached results and the noted chapter, so "Back to search results…" disappears. With no lookup under way the logo simply goes home. Ctrl/Cmd click still opens a new tab normally. See `app/BrandLink.js` and `app/searchSession.js`.

## Go to navigator
The right end of the toolbar is a dropdown showing where you are (e.g. "John 3"). Clicking it opens a panel that steps through Book → Chapter → Verse: books are grouped into Old and New Testament, then a grid of that book's chapters, then an "Open John 3" button with a grid of its verses underneath. Picking a verse opens the chapter with the same glide and focus as a search result. A breadcrumb at the top ("Books › Psalms › 23") steps back, and your current book and chapter are outlined in gold.

It never depends on hover: the panel eases to its new height in 85ms each time you step between books, chapters and verses (`RESIZE_MS`), and stays open while the pointer is anywhere, and clicks inside it (on a choice or on empty space) keep it open. It closes only on a click outside it, on Escape, or once you pick a destination. The mouse wheel over the panel scrolls just its list, never the page behind. Verse counts come from the selected version (`getNavData` in `lib/bible.js`). See `app/Navigator.js`.

## Search cache
When a search finishes, its ranked results are kept in `sessionStorage` (`bible-linker:search-cache`), alongside the last search term that drives the back link, so the two share a lifetime: the current tab. Returning to the same term (through the back link, the browser back button or a reload) shows the cached results instantly with no request, scrolled to where you were when you opened a result. Searching a new term, or the same term in a different version, replaces the cache. A search left before it finished isn't cached and simply runs again.

## Verse clicks: the Verse Editor
Clicking a verse opens the Verse Editor: a white, rounded popup that rises out of the exact spot clicked, with a tail pointing at the click, while every other verse, the heading and the footer dim to 30% opacity in 85ms. It is anchored just above the clicked line and grows upward as you write (below the line only if there's no room above). The flow is `VerseFocus.js` → `onVerseClick` in `app/verseActions.js` → `app/VerseEditor.js`.

**Double clicking** a verse that has no notes yet goes straight into writing a new one: the first click opens the popup and the second grows the (+) into the editor. On a verse that already has notes, a double click just opens the popup. Double clicks never select the word under them, and while writing, a double click on another verse inserts one reference, not two.

It has three states:

- **Open:** the verse's saved links, each collapsed to one entry, and a (+) button. With none yet it reads "No links for this verse".
- **Editing:** pressing (+) morphs that button into a small rich text editor in 85ms (same size, colour and radius to start, easing into the rounded editor window), and a fresh (+) spawns in below it over the same 85ms. The editor says "Click on another verse or start typing...". Selecting text offers bold, italic and link. **Clicking another verse while editing inserts a reference to it at the caret** (a link such as "John 3:17") instead of moving the editor. Pressing the new (+) saves the current note and starts another. Clicking a saved note's entry opens it for editing.
- **Collapsed:** clicking anywhere outside the editor saves the note and shrinks the popup to a dense list of the verse's links: each shows as much of its text as fits on one line, with "..." placed right where it would overflow (measured, preferring to break between words), with up to three of its verse references in small print beneath, and a (+) below. Clicking away again closes it and brings the text back.

Under the note's bottom right corner sit a **green check** and a **red bin**, for writing with the mouse. The check does what **Shift+Enter** does: it saves the note and returns to the verse's list (popup still open, the (+) right beside it for another); an empty note is simply dropped. The bin does what Escape does: a new note is thrown away, and an existing one being edited keeps its last saved text (its tooltip then reads "Discard changes"). They sit level with the centred (+), so the popup doesn't grow any taller for them.

### The note's colour
Beside the check and the bin sits a small circle in the note's highlight colour. Clicking it opens a wheel of the ten highlighter colours around a larger dot of the current one; clicking one picks it and closes the wheel (so do Escape, the circle again, or a click elsewhere). The new colour shows in the circle straight away and is kept when the note is saved; discarding the edits (the bin or Escape) keeps the old colour. A new note is given its starting colour as soon as it's begun (one its verses aren't using yet, where possible), so the circle always shows the colour it will be saved with.

### Formatting and the status bar
A slim bar runs along the bottom of the note showing **B**, **I**, **U** and **S** (bold, italic, underline, strikethrough), each lit when the text at the cursor has that format, or the start of the selection when text is selected. It follows the cursor as you type, click and move through the note, and also reflects a format switched on for the next letters (Ctrl+B with nothing selected lights B at once). Each letter is also a button: clicking it switches that format on or off at the cursor or across the selection, without taking the cursor out of the note. Shortcuts: **Ctrl+B**, **Ctrl+I**, **Ctrl+U**, **Ctrl+Shift+X** (Cmd on a Mac); hovering a letter shows its shortcut. Underline and strikethrough are also in the toolbar that appears when text is selected, next to bold, italic and link. They're small Editor.js inline tools in `app/formatTools.js`; registering them is also what lets Editor.js keep `<u>` and `<s>`/`<strike>` when the note is saved. Underline is read from the tags around the cursor, so a VerseRef's own link underline doesn't light U.

Keys while editing: **Shift+Enter** saves the note and stops there, back at the verse's list with the popup still open and no new note started (while the typed reference helper is showing, Shift+Enter belongs to it instead). **Ctrl+Enter** (Cmd+Enter on a Mac) saves the note and, in the same motion, opens a new one (it grows out of the (+) as a click would), so you can keep writing; press **Escape** once the new one appears to stop there. Ctrl+Enter on an empty note just cancels it. **Escape** first closes whatever small window is open over the note, one per press and topmost first: the colour wheel, the inline verse search, the typed reference helper, a VerseRef preview, or Editor.js's formatting or link toolbar, leaving the cursor in the note so you can carry on typing. Only when none is left does Escape discard the note being written (a new note isn't saved, an existing one keeps its last saved text) and return to the verse's list with a (+) below it. Escape never closes the popup itself; clicking away does.

A note left empty is discarded rather than saved. Editor.js is loaded only in the browser, fetched in the background as soon as the popup opens, and started only after the 85ms morph has finished, so the animation doesn't stutter.

The editor is **`@richview/editorjs` 2.27.0 rc.4**, a fork of Editor.js. It is a single release from April 2023 by one maintainer and has not been updated since; the official, maintained package is `@editorjs/editorjs`, which shares the same API if this ever needs swapping. Its block toolbox, drag handles, loading block and bottom padding are hidden to fit the small window (see `.ve-slot` rules in `app/globals.css`).

## VerseRefs and the inline verse search
A **VerseRef** is a link to a single verse placed inline in a VerseLink's text. VerseRefs show as blue links (and never break across lines); they're clickable in look but do nothing yet. Underneath, each is an ordinary link whose address is the verse (`/?ref=John%2013&v=34`), so Editor.js stores it as is; when the note is saved, `refsIn()` in `app/linkStore.js` collects them into the VerseLink's `refs`, and the collapsed list shows up to three of them, also in blue, under each note's preview.

Two ways to add one while writing:

- **Tab** opens a small, inline version of the search bar right under the cursor. Type as in the main search bar: after a 100ms pause it searches with the same API, algorithms and ranking and lists the top three matches (verse text, then reference and match %). ↑/↓ choose, **Enter** inserts the chosen match (or the top one if none is chosen) as a VerseRef at the cursor, and writing carries on from there. **Shift+Enter** (or Shift+click on a match) inserts the long form: the VerseRef followed by the verse itself in parentheses and quotes, e.g. John 13:34 (“A new commandment I give to you…”). Only the reference is the blue link; the quoted verse is ordinary text that can be edited like the rest of the note. Double quotes inside the verse become single ones so the quoting nests properly. **Escape** (or a click outside it) cancels just the search, returning to the note with nothing inserted. See `app/InlineVerseSearch.js`.
- **Clicking another verse** in the chapter inserts a VerseRef to it at the cursor.

Inside a note, Tab belongs to the inline search; everywhere else it still jumps to the main search bar.

## VerseRef preview
Resting the pointer on a VerseRef in a note shows a small preview below it: the verse with up to two verses either side, the referenced one emphasized. The verses of every VerseRef in a note are fetched as soon as the pointer enters the note, so the preview is on screen about 10ms after reaching the link and fully faded in within 85ms. It stays while the pointer is on the link or the preview (with a short grace period to move between them) and closes when it leaves both. Clicking a verse in the preview inserts a VerseRef to it at the note's cursor; Shift+click inserts the long form. It's meant for a quick look, not as a reader. See `app/VerseRefPreview.js` and `/api/verses?ref=John%203&v=16`.

## Help
Press **?** (when not typing), or click the **?** button in the bottom left corner, to open the Help screen: a full screen overlay listing every key and click by where it applies, drawn as keycaps (⇧ Shift + ↵ Enter, and so on; ⌘ Cmd appears in place of Ctrl on a Mac). Esc, ? again, the close button or a click on the dimmed backdrop closes it. While it's open, the page's other shortcuts stand down. In development, Next's own corner indicator is moved to the bottom right so it doesn't cover the button (`next.config.mjs`). See `app/HelpOverlay.js`.

## Typing a reference in a note
Writing a reference by hand in a VerseLink brings up a helper under the cursor as soon as a book name or abbreviation is followed by a space: "Jn " lists John's chapters; "Jn 1" lists every verse of John 1; "Jn 1:14" jumps to and highlights verse 14. It follows along as the reference is typed, shortened or changed, so it's fine to scroll, backspace and try another chapter. ↑/↓ move, Enter or a click chooses: a chapter fills in ("Jn 1:") and moves on to its verses; a verse turns what was typed into a VerseRef, **labelled the way it was written** ("Jn 1:14") and pointing to John 1:14. **Shift+Enter** or **Tab** (or Shift+click) on a verse inserts the long form, exactly as the inline search does: the VerseRef, labelled as typed, followed by the verse in parentheses and quotes, e.g. Jn 1:14 (“The Word became flesh…”). Only the reference is the blue link; the quote is ordinary text, with its double quotes turned into single ones. On the chapter list, Shift+Enter works like Enter. Escape closes it and leaves the text as typed (it stays closed for that reference). A book only counts when it starts with a capital letter, so everyday words like "is" or "am" don't set it off. References inserted from the inline search (Tab) or by clicking use full book names. The VerseLink's `refs` list always records full names. See `app/RefAssist.js`.

## A note's entry in the list
Each note in the Verse Editor's list previews its text in regular type: as much as fits on two lines (`LINES`), ending in "..." where it's cut, the cut measured and placed between words where one is close by. The note's own **bold**, *italic*, underline and strikethrough are kept, so starting a note with a bold line gives its preview a title, if you want one. Links show as plain text there. Up to three of its VerseRefs follow in blue, with a count of any others. See `app/NotePreview.js`, which the highlight bubble uses too, so a note looks the same in both places.

Clicking the entry opens the note for editing. Resting on one of its VerseRefs shows the verse preview; clicking a verse in that preview goes to it (or, while a note is being written, inserts a reference into it). The bin on the right deletes the note (after "Are you sure?").

## Deleting a VerseLink
Each note in the Verse Editor's list has a bin on the right. Clicking it opens out (85ms) into "Are you sure?" in red beside a neutral check and cross: the check deletes the note (its highlight goes with it), the cross keeps it.

## Version label
The app's version appears in small print under the Bible Linker logo, read from `package.json` (`0.27.0` shows as `v0.27`), so bumping the version there updates it.

## Passages: Shift+click groups of verses
Holding Shift while clicking verses in the chapter gathers them into one group for a single VerseLink, whether the verses sit together or apart. Each Shift+click adds the verse (or takes it out again if it's already in the group; the last one stays), the chosen verses stay bright while the rest dim, and the popup moves to sit just above the verse most recently added. With more than one verse the popup is headed by the passage, written the usual way (and it sits at the top of the group, near the middle, pointing at the group's first verse rather than at the verse last clicked):

- **Matthew 25:24-25** for verses next to each other,
- **Matthew 25:24,27,29** when there are gaps,
- and the two combined when needed, e.g. **Matthew 25:25-26,29**.

Pressing (+) then writes one note for the whole passage. While Shift is held (and you're not typing), the popup fades back and lets clicks through, so verses hidden underneath it can be added too. A plain click starts over with a single verse. Shift+mousedown doesn't make a browser text selection over the verses.

The popup lists every note that touches any of the chosen verses; a note covering different verses than the current selection shows which (e.g. "25:24,27,29") above its preview. A note always keeps the verses it was made for: opening it from one of its verses and editing it never changes its passage. A group note highlights each of its verses.

Groups are made in the chapter itself. While writing a note, clicking or Shift+clicking a verse still inserts a single verse VerseRef, and the inline verse search (Tab) only finds single verses.

## Highlights
Every VerseLink has a highlighter colour, one of ten fluorescent shades chosen to glow against the dark page at 30% while keeping the light text on them readable: yellow, orange, pink, magenta, violet, blue, cyan, mint, green and lime (no reds, so highlights never muddle Christ's words in red). Each also has a tilt between 0 and 2 degrees. Both are chosen when a note is begun (the colour can then be changed from the colour circle while writing it); a new link takes a colour its verse isn't using yet where possible. The colour shows as a thin strip down the left edge of the link's entry in the Verse Editor, and in the chapter the link's verse is highlighted in it: one strip per link per line the verse runs across, tilted by the link's angle, so a verse with several links looks heavily highlighted in several colours.

Overlaps never mix into a muddy colour. Each verse's strips are drawn solid, oldest first, and only then is the whole group made translucent (30%). Where strips overlap, only the most recent link's colour shows; where an older strip's edge sticks out from under a newer one (the tilts differ), that edge keeps its own colour. Highlights dim with their verse when another verse is isolated.

Resting the pointer on a highlight shows a bubble listing every link on that verse, newest first, each laid out exactly as in the Verse Editor's list (colour strip, two lines of its text, up to three VerseRefs, and its verses when it covers more than one); the link whose colour is showing under the pointer is tinted. The list scrolls when a verse has many. Clicking a link opens the Verse Editor straight into editing it; clicking one of its blue VerseRefs goes to that verse, so notes can be browsed from verse to verse through the bubbles alone.

The bubble is easy to reach: once it's up, the bubble itself, a 10px margin around it, and the strip of space between it and the highlighted line all count as still hovering, so moving the pointer up into it never makes it vanish or jump to another verse on the way. It stays as long as the pointer is anywhere in that area and goes 400ms after the pointer leaves it (`LEAVE_MS`, `SLACK` in `app/HighlightLayer.js`). The strips sit behind the text, so the layer finds the strip under the pointer with `elementsFromPoint`. Bubbles don't appear while the Verse Editor is open, and clicking the text puts one away at once. Highlights update live as links are saved or removed, and re-measure when a verse grows on hover, the text size or font changes, or the column is resized. See `app/HighlightLayer.js`.

Links saved before colours existed get a steady colour and tilt from their id (from the original six colours, so they look as they always have).

A note over several verses always shows its bubble, and the Verse Editor while that note is being written, at the **top of its group, near the middle**, pointing at its first verse, wherever in the group the pointer rested or clicked. Horizontally that's the middle of the whole group, pulled onto the first verse's own words when that verse starts partway along its line. See `app/groupAnchor.js`.

## VerseLinks and `link-data`
Notes are stored as **VerseLinks** in `localStorage` under `link-data`, an array of objects. Browser storage belongs to the user's own browser profile, so links are private to each user and never shared across the site. See `app/linkStore.js`.

```js
{
  id: "…",
  anchor: { book: "matthew", chapter: 25, verse: 24, verses: [24, 27, 29] },
                                                      // the verse(s) it belongs to, one chapter; verse is the first
                                                      // (book is a slug, so it holds in every version)
  content: { time, blocks: [...], version },          // rich text, as Editor.js saves it
  refs: [{ label: "John 3:17", book: "John", chapter: 3, verse: 17, href: "/?ref=John%203&v=17" }],
  created: 1727380000000, updated: 1727380000000,
  color: "pink",                                      // highlighter colour (HIGHLIGHTS in linkStore.js)
  tilt: 1.37                                          // highlight angle, 0 to 2 degrees
}
```

Inline verse references are ordinary links to a verse inside the rich text; `refs` is rebuilt from them each time the note is saved. The reset button does not touch `link-data`.

## Christ's words in red
The switch at the top (where the alignment buttons used to be; text is now always justified) turns red letter text on and off. Off, its track is white and its knob shows a no entry sign; on, the track turns red and the knob slides across showing a bold J. The slide and both colour changes take 85ms. It's off by default, remembered like the other settings, and turned off by the reset button. The red is `#f26b6b` (`--red`), a lighter red at 6.2:1 against the page; hovered red words brighten slightly. Verse numbers stay gold.

The texts in `app-data` don't mark Christ's words, so `scripts/import-redletter.mjs` (`npm run import-redletter`) reads editions that do, from [seven1m/open-bibles](https://github.com/seven1m/open-bibles): the WEB (`<wj>` tags) and the KJV (`<q who="Jesus">` markers). For each marked verse it aligns that edition word by word with the stored text and writes which words are red to `app-data/bible/<version>/red.json` as word ranges per verse. 99.6% of WEB words and 99.9% of KJV words in marked verses align exactly; the rest take their neighbours' colour. Narration such as "Jesus answered him," stays white. **The BBE was never published as a red letter edition, so it has no red text.**

## Keyboard: Tab
Tab jumps straight into the search bar with the cursor at the end of any text there, from anywhere except while writing a VerseLink note (there Tab opens the inline verse search). The key is absorbed: the browser's usual Tab (stepping from control to control) no longer happens. Shift+Tab is left alone, so the page's controls can still be reached by keyboard (`app/TabToSearch.js`).

## Keyboard: arrows
← and → step to the previous and next chapter, crossing book boundaries like the pager (`app/ChapterKeys.js`). They're ignored while typing (search, the Verse Editor, dropdowns), inside the go to navigator, or with a modifier key held.
