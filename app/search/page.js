import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseReference } from "../../lib/bible";
import Bar from "../Bar";
import SearchResults from "../SearchResults";
import { VERSION_COOKIE, versionOf } from "../../lib/versions";

export const dynamic = "force-dynamic";

// [16, 17, 18, 21] → "16-18,21", as references are written.
const compact = (list) => {
  const runs = [];
  for (const v of list) { const last = runs[runs.length - 1]; if (last && v === last[1] + 1) last[1] = v; else runs.push([v, v]); }
  return runs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(",");
};

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return { title: q ? `“${q}” · Bible Linker 📚` : "Search · Bible Linker 📚" };
}

export default async function SearchPage({ searchParams }) {
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
  const version = versionOf((await cookies()).get(VERSION_COOKIE)?.value);

  // A Bible location goes straight to its chapter: with verses (John 3:16, Jn 3:16-18,
  // Matthew 25:24,27,29) they're revealed there with the rest dimmed; a bare chapter
  // (Matthew 25) simply opens.
  const ref = q ? await parseReference(q) : null;
  if (ref) {
    const chapterRef = encodeURIComponent(`${ref.name} ${ref.chapter}`);
    redirect(ref.verses ? `/?ref=${chapterRef}&v=${encodeURIComponent(compact(ref.verses))}` : `/?ref=${chapterRef}`);
  }

  return (
    <main className="shell">
      <Bar version={version.id} query={q} />
      <section className="results-page">
        {q ? (
          <>
            <h1 className="results-title">
              <span className="label">Results for</span>
              <span className="q">{q}</span>
            </h1>
            <SearchResults key={`${version.id}:${q}`} q={q} versionId={version.id} versionName={version.name} />
          </>
        ) : (
          <p className="results-status">Type a verse (“John 3:16”) or a word or phrase into the search bar.</p>
        )}
      </section>
    </main>
  );
}
