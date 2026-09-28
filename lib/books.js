// The 66 books: slug, name (as the texts spell it), chapter count, and the usual
// abbreviations people write (Jn, Rev, 1 Cor, Ps…). Shared by the server (search
// and references) and the browser (the reference helper in the Verse Editor).
export const BOOKS = [
  ["genesis", "Genesis", 50, "gen ge gn"],
  ["exodus", "Exodus", 40, "ex exo exod"],
  ["leviticus", "Leviticus", 27, "lev le lv"],
  ["numbers", "Numbers", 36, "num nu nm nb"],
  ["deuteronomy", "Deuteronomy", 34, "deut de dt"],
  ["joshua", "Joshua", 24, "josh jos jsh"],
  ["judges", "Judges", 21, "judg jdg jg jdgs"],
  ["ruth", "Ruth", 4, "rth ru"],
  ["1samuel", "1 Samuel", 31, "1sam 1sa 1sm 1s"],
  ["2samuel", "2 Samuel", 24, "2sam 2sa 2sm 2s"],
  ["1kings", "1 Kings", 22, "1kgs 1ki 1kg 1k"],
  ["2kings", "2 Kings", 25, "2kgs 2ki 2kg 2k"],
  ["1chronicles", "1 Chronicles", 29, "1chr 1ch 1chron"],
  ["2chronicles", "2 Chronicles", 36, "2chr 2ch 2chron"],
  ["ezra", "Ezra", 10, "ezr ez"],
  ["nehemiah", "Nehemiah", 13, "neh ne"],
  ["esther", "Esther", 10, "esth est es"],
  ["job", "Job", 42, "jb"],
  ["psalms", "Psalms", 150, "ps psa pss psalm psm"],
  ["proverbs", "Proverbs", 31, "prov pr prv pro"],
  ["ecclesiastes", "Ecclesiastes", 12, "eccl ecc ec qoh"],
  ["songofsolomon", "Song of Solomon", 8, "song sos ss sg cant songofsongs"],
  ["isaiah", "Isaiah", 66, "isa is"],
  ["jeremiah", "Jeremiah", 52, "jer je jr"],
  ["lamentations", "Lamentations", 5, "lam la"],
  ["ezekiel", "Ezekiel", 48, "ezek eze ezk"],
  ["daniel", "Daniel", 12, "dan da dn"],
  ["hosea", "Hosea", 14, "hos ho"],
  ["joel", "Joel", 3, "jl"],
  ["amos", "Amos", 9, "am"],
  ["obadiah", "Obadiah", 1, "obad ob"],
  ["jonah", "Jonah", 4, "jon jnh"],
  ["micah", "Micah", 7, "mic mi"],
  ["nahum", "Nahum", 3, "nah na"],
  ["habakkuk", "Habakkuk", 3, "hab hb"],
  ["zephaniah", "Zephaniah", 3, "zeph zep zp"],
  ["haggai", "Haggai", 2, "hag hg"],
  ["zechariah", "Zechariah", 14, "zech zec zc"],
  ["malachi", "Malachi", 4, "mal ml"],
  ["matthew", "Matthew", 28, "matt mt mat"],
  ["mark", "Mark", 16, "mk mrk mr"],
  ["luke", "Luke", 24, "lk luk"],
  ["john", "John", 21, "jn jhn joh"],
  ["acts", "Acts", 28, "ac act"],
  ["romans", "Romans", 16, "rom ro rm"],
  ["1corinthians", "1 Corinthians", 16, "1cor 1co"],
  ["2corinthians", "2 Corinthians", 13, "2cor 2co"],
  ["galatians", "Galatians", 6, "gal ga"],
  ["ephesians", "Ephesians", 6, "eph ephes"],
  ["philippians", "Philippians", 4, "phil php pp"],
  ["colossians", "Colossians", 4, "col co"],
  ["1thessalonians", "1 Thessalonians", 5, "1thess 1th 1thes"],
  ["2thessalonians", "2 Thessalonians", 3, "2thess 2th 2thes"],
  ["1timothy", "1 Timothy", 6, "1tim 1ti 1tm"],
  ["2timothy", "2 Timothy", 4, "2tim 2ti 2tm"],
  ["titus", "Titus", 3, "tit ti"],
  ["philemon", "Philemon", 1, "phlm phm philem"],
  ["hebrews", "Hebrews", 13, "heb he"],
  ["james", "James", 5, "jas jm"],
  ["1peter", "1 Peter", 5, "1pet 1pe 1pt 1p"],
  ["2peter", "2 Peter", 3, "2pet 2pe 2pt 2p"],
  ["1john", "1 John", 5, "1jn 1jhn 1jo 1joh"],
  ["2john", "2 John", 1, "2jn 2jhn 2jo 2joh"],
  ["3john", "3 John", 1, "3jn 3jhn 3jo 3joh"],
  ["jude", "Jude", 1, "jud jd"],
  ["revelation", "Revelation", 22, "rev re rv revelations apocalypse"],
].map(([slug, name, chapters, abbr]) => ({ slug, name, chapters, abbr: abbr.split(" ") }));

// Lower case, letters and digits only: "1 Cor." → "1cor", "Song of Songs" → "songofsongs".
export const keyOf = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Every exact way of writing each book: its slug, its name, and its abbreviations.
const EXACT = new Map();
for (const b of BOOKS) for (const k of [b.slug, keyOf(b.name), ...b.abbr]) if (!EXACT.has(k)) EXACT.set(k, b);

// The book a written name or abbreviation means, or null. Exact spellings and
// abbreviations first; otherwise an unambiguous start of a full name, at least
// three letters long ("Hebr", "Deuter"), so everyday words aren't taken for books.
export function resolveBook(token) {
  const k = keyOf(token);
  if (!k) return null;
  if (EXACT.has(k)) return EXACT.get(k);
  if (k.replace(/^\d/, "").length < 3) return null;
  const hits = BOOKS.filter((b) => b.slug.startsWith(k));
  return hits.length === 1 ? hits[0] : null;
}
