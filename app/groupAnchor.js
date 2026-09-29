// Where popups about a group of verses (one VerseLink over several verses) point:
// the top of the group, near its middle, rather than wherever the pointer happened
// to be. That's the first line of the group's first verse. Horizontally it's the
// middle of the whole group, pulled onto that first line's own words when the verse
// starts partway along the line, so the popup always points at the starting verse.
//
// Returns { x, top, bottom } in viewport coordinates, or null if the verses aren't
// on the page.
export function groupTop(verses) {
  const list = [...new Set(verses.map(Number))].sort((a, b) => a - b);
  if (!list.length) return null;
  const words = (v) => [...document.querySelectorAll(`.reader .w[data-v="${v}"]`)];

  const first = words(list[0]);
  if (!first.length) return null;

  // The whole group's horizontal extent.
  let left = Infinity, right = -Infinity;
  for (const v of list) {
    for (const w of words(v)) {
      for (const r of w.getClientRects()) {
        if (!r.width) continue;
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
      }
    }
  }

  // The first verse's first line.
  const rects = first.flatMap((w) => [...w.getClientRects()]).filter((r) => r.width);
  if (!rects.length) return null;
  const top = Math.min(...rects.map((r) => r.top));
  const line = rects.filter((r) => Math.abs(r.top - top) < r.height * 0.5);
  const segL = Math.min(...line.map((r) => r.left));
  const segR = Math.max(...line.map((r) => r.right));
  const bottom = Math.max(...line.map((r) => r.bottom));

  const mid = (left + right) / 2;
  const inset = Math.min(8, (segR - segL) / 2);
  const x = Math.min(segR - inset, Math.max(segL + inset, mid));
  return { x, top, bottom };
}
