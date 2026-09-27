"use client";

import { useEffect, useState } from "react";

import { LAST_SEARCH_KEY, CACHE_KEY } from "./searchSession";

// LAST_SEARCH_KEY drives the "Back to search results…" link; CACHE_KEY holds that
// same search's finished results (and where the page was scrolled), so going back
// shows them instantly instead of searching again. A new search replaces both.
const SHOWN = 250; // rank everything, but only keep the best this many on the page

const MODE_LABEL = {
  "jaro-winkler": "Ranked by Jaro-Winkler similarity",
  levenshtein: "Ranked by Levenshtein distance",
  reference: "Verse reference",
};

// Higher score first; equal scores keep Bible order.
const before = (a, b) => a.score > b.score || (a.score === b.score && a.o < b.o);

// Insert each new match at its ranked position (binary search), so the list is
// always in score order no matter which book a match arrived from.
function insertRanked(list, items) {
  const next = list.slice();
  for (const it of items) {
    let lo = 0, hi = next.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (before(next[mid], it)) lo = mid + 1; else hi = mid;
    }
    if (lo < SHOWN) next.splice(lo, 0, it);
  }
  if (next.length > SHOWN) next.length = SHOWN;
  return next;
}

function readCache(q, versionId) {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (c && c.q === q && c.version === versionId && Array.isArray(c.results)) return c;
  } catch {}
  return null;
}

export default function SearchResults({ q, versionId, versionName }) {
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState(null);
  const [book, setBook] = useState(null);
  const [state, setState] = useState("init"); // init | searching | done | error
  const [restoreY, setRestoreY] = useState(null);

  useEffect(() => {
    try { sessionStorage.setItem(LAST_SEARCH_KEY, q); } catch {}

    // Same term (and version) as the cached search: show it as it was, no request.
    const cached = readCache(q, versionId);
    if (cached) {
      setResults(cached.results);
      setTotal(cached.total);
      setMode(cached.mode);
      setState("done");
      setRestoreY(cached.scrollY ?? 0);
      return;
    }

    // A new term: the old cache no longer applies.
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}

    // Each run owns its own request. React runs effects twice in development
    // (mount, clean up, mount again), so the first request gets aborted and the
    // second takes over; anything arriving for an aborted run is ignored.
    const ctrl = new AbortController();
    const live = () => !ctrl.signal.aborted;
    let list = [], count = 0, algo = null;
    setResults([]); setTotal(0); setMode(null); setBook(null); setState("searching");

    (async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok || !res.body) throw new Error(`Search request failed: ${res.status}`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done || !live()) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (!line || !live()) continue;
            const msg = JSON.parse(line);
            if (msg.type === "start") setMode((algo = msg.mode));
            else if (msg.type === "progress") setBook(msg.book);
            else if (msg.type === "matches") {
              list = insertRanked(list, msg.items);
              count += msg.items.length;
              setResults(list);
              setTotal(count);
            } else if (msg.type === "done") {
              finished = true;
              setState("done");
              try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ q, version: versionId, results: list, total: count, mode: algo, scrollY: 0 }));
              } catch {}
            } else if (msg.type === "error") setState("error");
          }
        }
        // The stream closed without its "done" message: say so rather than spin forever.
        if (live() && !finished) setState("error");
      } catch (e) {
        if (live() && e.name !== "AbortError") setState("error");
      }
    })();
    return () => ctrl.abort();
  }, [q, versionId]);

  // Back from a chapter: put the page where it was when the result was clicked.
  useEffect(() => {
    if (restoreY === null) return;
    requestAnimationFrame(() => window.scrollTo(0, restoreY));
  }, [restoreY]);

  // Remember the scroll position with the cached results as a result is opened.
  const rememberScroll = () => {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && c.q === q) sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...c, scrollY: window.scrollY }));
    } catch {}
  };

  if (state === "init") return null; // deciding between cache and a fresh search

  const count = `${total.toLocaleString()} ${total === 1 ? "verse" : "verses"}`;
  let status;
  if (state === "error") status = "Something went wrong with the search.";
  else if (state === "searching") status = `Searching ${book ?? versionName}… ${total ? `${count} so far` : ""}`;
  else if (!total) status = `No matching verses in the ${versionName}.`;
  else status = `${count} in the ${versionName}${total > SHOWN ? `, showing the top ${SHOWN}` : ""}`;

  return (
    <>
      <p className="results-status" aria-live="polite">
        {status}
        {mode && <span className="mode">{MODE_LABEL[mode]}</span>}
      </p>
      <ol className={restoreY !== null ? "results cached" : "results"} onClick={rememberScroll}>
        {results.map((r) => (
          <li key={`${r.slug}-${r.c}-${r.v}`} className="result">
            <a href={`/?ref=${encodeURIComponent(`${r.book} ${r.c}`)}&v=${r.v}`}>
              <span className="text">{r.text}</span>
              <span className="where">
                {r.book} {r.c}:{r.v}
                {mode !== "reference" && <span className="score">{Math.round(r.score * 100)}% match</span>}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
