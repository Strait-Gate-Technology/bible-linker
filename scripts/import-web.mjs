// Downloads the World English Bible (public domain) and converts it into compact
// per-book JSON files in app-data/bible/web/. Run once: npm run import-bible
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json/";
const OUT = path.join(process.cwd(), "app-data", "bible", "web");

const BOOKS = [
  ["genesis","Genesis"],["exodus","Exodus"],["leviticus","Leviticus"],["numbers","Numbers"],["deuteronomy","Deuteronomy"],
  ["joshua","Joshua"],["judges","Judges"],["ruth","Ruth"],["1samuel","1 Samuel"],["2samuel","2 Samuel"],
  ["1kings","1 Kings"],["2kings","2 Kings"],["1chronicles","1 Chronicles"],["2chronicles","2 Chronicles"],
  ["ezra","Ezra"],["nehemiah","Nehemiah"],["esther","Esther"],["job","Job"],["psalms","Psalms"],["proverbs","Proverbs"],
  ["ecclesiastes","Ecclesiastes"],["songofsolomon","Song of Solomon"],["isaiah","Isaiah"],["jeremiah","Jeremiah"],
  ["lamentations","Lamentations"],["ezekiel","Ezekiel"],["daniel","Daniel"],["hosea","Hosea"],["joel","Joel"],["amos","Amos"],
  ["obadiah","Obadiah"],["jonah","Jonah"],["micah","Micah"],["nahum","Nahum"],["habakkuk","Habakkuk"],["zephaniah","Zephaniah"],
  ["haggai","Haggai"],["zechariah","Zechariah"],["malachi","Malachi"],
  ["matthew","Matthew"],["mark","Mark"],["luke","Luke"],["john","John"],["acts","Acts"],["romans","Romans"],
  ["1corinthians","1 Corinthians"],["2corinthians","2 Corinthians"],["galatians","Galatians"],["ephesians","Ephesians"],
  ["philippians","Philippians"],["colossians","Colossians"],["1thessalonians","1 Thessalonians"],["2thessalonians","2 Thessalonians"],
  ["1timothy","1 Timothy"],["2timothy","2 Timothy"],["titus","Titus"],["philemon","Philemon"],["hebrews","Hebrews"],
  ["james","James"],["1peter","1 Peter"],["2peter","2 Peter"],["1john","1 John"],["2john","2 John"],["3john","3 John"],
  ["jude","Jude"],["revelation","Revelation"],
];

// Output shape per chapter: array of paragraphs.
//   paragraph = { poetry: boolean, lines: [ [ [verseNumberOrZero, "text"], ... ], ... ] }
// A verse number is only set on the first segment of that verse within the chapter.
function convert(entries) {
  const chapters = {};
  const seen = {};
  let para = null, line = null, poetry = false, chapter = null;
  const ensureChapter = (c) => { chapters[c] ??= []; seen[c] ??= new Set(); };
  const closePara = () => { para = null; line = null; };
  const openPara = (c, isPoetry) => {
    ensureChapter(c);
    para = { poetry: isPoetry, lines: [] };
    line = [];
    para.lines.push(line);
    chapters[c].push(para);
    chapter = c;
  };

  for (const e of entries) {
    switch (e.type) {
      case "paragraph start": poetry = false; closePara(); break;
      case "stanza start": poetry = true; closePara(); break;
      case "paragraph end": case "stanza end": closePara(); break;
      case "line break":
        if (para) { line = []; para.lines.push(line); }
        break;
      case "paragraph text":
      case "line text": {
        const text = e.value.replace(/\s+/g, " ").trim();
        if (!text) break;
        const c = e.chapterNumber;
        if (!para || chapter !== c) openPara(c, e.type === "line text" || poetry);
        const first = !seen[c].has(e.verseNumber);
        seen[c].add(e.verseNumber);
        line.push([first ? e.verseNumber : 0, text]);
        break;
      }
      default: break; // headers, breaks, etc. are ignored
    }
  }
  for (const c of Object.keys(chapters)) {
    chapters[c] = chapters[c]
      .map((p) => ({ poetry: p.poetry, lines: p.lines.filter((l) => l.length) }))
      .filter((p) => p.lines.length);
  }
  return chapters;
}

await mkdir(OUT, { recursive: true });
const index = [];
for (const [slug, name] of BOOKS) {
  const res = await fetch(`${BASE}${slug}.json`);
  if (!res.ok) throw new Error(`Failed to download ${slug}: ${res.status}`);
  const chapters = convert(await res.json());
  await writeFile(path.join(OUT, `${slug}.json`), JSON.stringify({ slug, name, chapters }));
  index.push({ slug, name, chapters: Object.keys(chapters).length });
  console.log(`✓ ${name} (${index.at(-1).chapters} chapters)`);
}
await writeFile(path.join(OUT, "index.json"), JSON.stringify({
  translation: "World English Bible (WEB)",
  license: "Public domain",
  source: "https://github.com/TehShrike/world-english-bible",
  books: index,
}, null, 1));
