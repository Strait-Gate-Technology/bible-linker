// Everything a "lookup session" keeps in sessionStorage (so it lasts for the tab).
//   LAST_SEARCH_KEY  the most recent search term; shows "Back to search results…"
//   CACHE_KEY        that search's finished, ranked results and scroll position
//   ORIGIN_KEY       the chapter being read when the session's first search began;
//                    the Bible Linker logo returns there and ends the session
export const LAST_SEARCH_KEY = "bible-linker:last-search";
export const CACHE_KEY = "bible-linker:search-cache";
export const ORIGIN_KEY = "bible-linker:pre-search";

const get = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };

// Called as a search is submitted. Only the first search of a session records
// where the reader was; later searches (from results or result chapters) keep it.
export function noteOrigin() {
  if (get(LAST_SEARCH_KEY) || get(ORIGIN_KEY)) return;
  if (window.location.pathname !== "/") return; // only chapters count as "where I was"
  const url = new URL(window.location.href);
  url.searchParams.delete("v");
  url.hash = "";
  try { sessionStorage.setItem(ORIGIN_KEY, url.pathname + url.search); } catch {}
}

// Ends the session and returns the chapter to go back to ("/" if none was recorded).
export function endSession() {
  const origin = get(ORIGIN_KEY);
  try { [LAST_SEARCH_KEY, CACHE_KEY, ORIGIN_KEY].forEach((k) => sessionStorage.removeItem(k)); } catch {}
  return origin && origin.startsWith("/") ? origin : "/";
}
