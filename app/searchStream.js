// Reads /api/search's newline separated JSON stream, calling onMessage for each
// message as it arrives. Resolves true if the stream ended with its "done" message.
export async function streamSearch(q, signal, onMessage) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal, cache: "no-store" });
  if (!res.ok || !res.body) throw new Error(`Search request failed: ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done || signal?.aborted) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (!line || signal?.aborted) continue;
      const msg = JSON.parse(line);
      if (msg.type === "done") finished = true;
      onMessage(msg);
    }
  }
  return finished;
}

// Same ranking as the results page: higher score first, ties in Bible order.
export const ranksBefore = (a, b) => a.score > b.score || (a.score === b.score && a.o < b.o);

// Keep only the best `limit` of `list` plus `items`, in ranked order.
export function topRanked(list, items, limit) {
  const next = list.slice();
  for (const it of items) {
    let lo = 0, hi = next.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ranksBefore(next[mid], it)) lo = mid + 1; else hi = mid;
    }
    if (lo < limit) next.splice(lo, 0, it);
  }
  if (next.length > limit) next.length = limit;
  return next;
}

export const verseHref = (r) => `/?ref=${encodeURIComponent(`${r.book} ${r.c}`)}&v=${r.v}`;
