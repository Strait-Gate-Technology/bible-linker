import Link from "next/link";
import { cookies } from "next/headers";
import { getChapter, getRed, resolveReference } from "../lib/bible";
import VerseFocus from "./VerseFocus";
import SearchArrival from "./SearchArrival";
import VerseEditor from "./VerseEditor";
import ChapterKeys from "./ChapterKeys";
import { VERSION_COOKIE, versionOf } from "../lib/versions";
import ColumnResize from "./ColumnResize";
import HighlightLayer from "./HighlightLayer";
import Bar from "./Bar";

export const dynamic = "force-dynamic";

// Total time over which the whole chapter is revealed, and the cap on the
// per-word delay so short chapters still feel like typing rather than a flash.
const REVEAL_TOTAL_MS = 4200;
const MAX_STEP_MS = 70;

export default async function Home({ searchParams }) {
  const { ref, v } = await searchParams;
  const query = Array.isArray(ref) ? ref[0] : ref;
  const version = versionOf((await cookies()).get(VERSION_COOKIE)?.value);

  const resolved = query ? await resolveReference(query) : { book: "john", chapter: 1 };
  const data = resolved ? await getChapter(resolved.book, resolved.chapter, version.id) : null;

  if (!data) {
    return (
      <main className="shell">
        <Bar version={version.id} showBack />
        <section className="notfound">
          <h1>Reference not found</h1>
          <p>“{query}” doesn’t match a book in this Bible. Try “Psalms 23” or “1 Corinthians 13”.</p>
          <Link href="/">Back to John 1</Link>
        </section>
      </main>
    );
  }

  // Number every word once, in reading order, so each gets its place in the reveal.
  // Each word also remembers which verse it belongs to, for the hover highlight, and
  // whether it's one of Christ's words (red letter ranges count words per verse).
  const red = await getRed(version.id, resolved.book, data.chapter);
  const wordInVerse = new Map();
  const isRed = (verse) => {
    const k = wordInVerse.get(verse) ?? 0;
    wordInVerse.set(verse, k + 1);
    return (red[verse] ?? []).some(([a, b]) => k >= a && k < b);
  };
  let n = 0;
  let currentVerse = 0;
  const paragraphs = data.paragraphs.map((p) => ({
    poetry: p.poetry,
    lines: p.lines.map((line) =>
      line.map(([verse, text]) => {
        if (verse > 0) currentVerse = verse;
        return {
          verse,
          words: text.split(" ").map((w, k) => ({ w, i: n++, v: currentVerse, verse: k === 0 ? verse : 0, wj: isRed(currentVerse) })),
        };
      })
    ),
  }));
  const step = Math.min(MAX_STEP_MS, REVEAL_TOTAL_MS / Math.max(n, 1));

  // Opened from a search result (?v=16): show the chapter at once, no word by word
  // reveal; SearchArrival then scrolls to that verse and dims the rest.
  // ?v= may be one verse (16), a range (16-18) or a list (24,27,29).
  const inChapter = new Set(paragraphs.flatMap((p) => p.lines.flatMap((l) => l.map((seg) => seg.verse))));
  const focusSet = new Set();
  for (const part of String(Array.isArray(v) ? v[0] : v ?? "").split(",")) {
    const [a, b] = part.split(/[-–]/).map((x) => parseInt(x, 10));
    if (!a) continue;
    for (let n = Math.min(a, b || a); n <= Math.max(a, b || a) && n - Math.min(a, b || a) < 200; n++) if (inChapter.has(n)) focusSet.add(n);
  }
  const focus = focusSet.size ? [...focusSet].sort((x, y) => x - y).join(",") : null;

  return (
    <main className="shell" style={{ "--step": `${step.toFixed(3)}ms` }}>
      <Bar current={`${data.name} ${data.chapter}`} version={version.id} showBack />

      <article
        key={`${version.id}-${data.name}-${data.chapter}-${focus ?? ""}`}
        className={focus ? "reader instant" : "reader"} aria-label={`${data.name} ${data.chapter}`}>
        <h1 className="chapter">
          <span className="book">{data.name}</span>
          <span className="num">{data.chapter}</span>
        </h1>

        <div className="text-col">
          <HighlightLayer key={`hl-${data.name}-${data.chapter}`} slug={resolved.book} chapter={data.chapter} />
          {paragraphs.map((p, pi) => (
            <div key={pi} className={p.poetry ? "para poem" : "para"}>
              {p.lines.map((line, li) => (
                <p key={li} className="line">
                  {line.map((seg, si) =>
                    seg.words.map((word, wi) => (
                      // The trailing space lives inside the word so it grows with the word.
                      <span key={`${si}-${wi}`} className={`w${focusSet.has(word.v) ? " hit" : ""}${word.wj ? " wj" : ""}`} data-v={word.v} style={{ "--i": word.i }}>
                        {word.verse > 0 && <sup className="v" id={`v${word.verse}`}>{word.verse}</sup>}
                        {word.w}{" "}
                      </span>
                    ))
                  )}
                </p>
              ))}
            </div>
          ))}
          <ColumnResize key={`resize-${version.id}-${data.name}-${data.chapter}`} />
        </div>

        <nav className="pager" aria-label="Chapters">
          {data.prev ? <Link href={`/?ref=${encodeURIComponent(data.prev)}`}>{data.prev}</Link> : <span />}
          {data.next ? <Link href={`/?ref=${encodeURIComponent(data.next)}`}>{data.next}</Link> : <span />}
        </nav>
        <p className="credit">{version.name} · public domain</p>
      </article>
      <VerseFocus key={`${version.id}-${data.name}-${data.chapter}`} />
      <VerseEditor key={`editor-${version.id}-${data.name}-${data.chapter}`} book={data.name} slug={resolved.book} chapter={data.chapter} />
      <ChapterKeys prev={data.prev} next={data.next} />
      {focus && <SearchArrival key={`arrive-${version.id}-${data.name}-${data.chapter}-${focus}`} />}
    </main>
  );
}
