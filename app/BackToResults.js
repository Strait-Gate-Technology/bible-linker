"use client";

import { useEffect, useState } from "react";
import { LAST_SEARCH_KEY } from "./searchSession";

// Shown in the top left of chapter pages only once a search has been run in this
// tab; it returns to that search's results.
export default function BackToResults() {
  const [q, setQ] = useState(null);

  useEffect(() => {
    try { setQ(sessionStorage.getItem(LAST_SEARCH_KEY)); } catch {}
  }, []);

  if (!q) return null;

  return (
    <a className="backlink" href={`/search?q=${encodeURIComponent(q)}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="M11 6l-6 6 6 6" />
      </svg>
      Back to search results…
    </a>
  );
}
