import { cookies } from "next/headers";
import { getIndex, getVerses, parseReference } from "../../../lib/bible";
import { modeFor, scorerFor } from "../../../lib/search";
import { VERSION_COOKIE, versionOf } from "../../../lib/versions";

export const dynamic = "force-dynamic";

// Streams matches as newline separated JSON, one book at a time, so the results
// page can show verses the moment they're found instead of after the whole Bible.
//   { type: "start", mode }            which algorithm is ranking this query
//   { type: "progress", book }         the book now being searched
//   { type: "matches", items: [...] }  { book, slug, c, v, text, score, o }
//   { type: "done", total }
export async function GET(request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  const version = versionOf((await cookies()).get(VERSION_COOKIE)?.value).id;
  const enc = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const { books } = await getIndex(version);
        const ref = q ? await parseReference(q) : null;

        if (ref) {
          // A verse reference: return exactly that verse (or range, or whole chapter).
          send({ type: "start", mode: "reference" });
          const rows = (await getVerses(version, ref.book)).filter(
            (r) => r.c === ref.chapter && (!ref.verses || ref.verses.includes(r.v))
          );
          const items = rows.map((r, o) => ({ book: ref.name, slug: ref.book, c: r.c, v: r.v, text: r.text, score: 1, o }));
          if (items.length) send({ type: "matches", items });
          send({ type: "done", total: items.length });
          return;
        }

        const mode = modeFor(q);
        const score = scorerFor(q);
        send({ type: "start", mode });
        let total = 0, o = 0;
        for (const b of books) {
          if (cancelled) return;
          send({ type: "progress", book: b.name });
          const items = [];
          for (const r of await getVerses(version, b.slug)) {
            const s = score(r.text);
            if (s > 0) items.push({ book: b.name, slug: b.slug, c: r.c, v: r.v, text: r.text, score: Math.round(s * 1e4) / 1e4, o });
            o++;
          }
          total += items.length;
          if (items.length) send({ type: "matches", items });
          await new Promise((res) => setTimeout(res, 0)); // let this book's results flush before the next
        }
        send({ type: "done", total });
      } catch (err) {
        if (!cancelled) send({ type: "error", message: "Search failed." });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
