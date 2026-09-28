import { cookies } from "next/headers";
import { getIndex, getVerses, resolveReference } from "../../../lib/bible";
import { VERSION_COOKIE, versionOf } from "../../../lib/versions";

export const dynamic = "force-dynamic";

const AROUND = 2; // verses shown on each side of the one asked for (without &all)

// A verse and the verses around it, for the VerseRef hover preview.
//   GET /api/verses?ref=John%203&v=16
//   → { book: "John", chapter: 3, focus: 16, verses: [{ v, text }, …] }
// With &all=1 (and v optional): every verse of the chapter, for the reference helper.
export async function GET(request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const focus = Number(url.searchParams.get("v"));
  const all = url.searchParams.has("all");
  const version = versionOf((await cookies()).get(VERSION_COOKIE)?.value).id;

  const hit = ref ? await resolveReference(ref, null) : null;
  if (!hit || (!focus && !all)) return Response.json({ error: "Not found" }, { status: 404 });

  const { books } = await getIndex(version);
  const name = books.find((b) => b.slug === hit.book)?.name ?? ref;
  const verses = (await getVerses(version, hit.book))
    .filter((r) => r.c === hit.chapter && (all || (r.v >= focus - AROUND && r.v <= focus + AROUND)))
    .map((r) => ({ v: r.v, text: r.text }));
  if (!verses.length || (focus && !verses.some((r) => r.v === focus))) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({ book: name, chapter: hit.chapter, focus, verses }, { headers: { "Cache-Control": "no-store" } });
}
