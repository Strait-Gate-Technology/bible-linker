// Verse search scoring. Queries of one or two words are matched word by word with
// Jaro-Winkler similarity; longer queries are matched as a phrase with Levenshtein
// edit distance. Both produce a score from 0 to 1 (1 = exact), which the results
// page ranks by.

export const JW_MIN = 0.9;   // each query word needs a verse word at least this similar
export const LEV_MIN = 0.75; // phrase score floor: at most a quarter of the query's letters edited

// Lower case, curly apostrophes dropped ("didn’t" → "didnt"), everything that isn't a
// letter or digit turned into a single space.
export function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/['’‘]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const modeFor = (query) => (normalize(query).split(" ").filter(Boolean).length <= 2 ? "jaro-winkler" : "levenshtein");

// ---------- Jaro-Winkler ----------
export function jaroWinkler(a, b) {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const win = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Uint8Array(la), mb = new Uint8Array(lb);
  let m = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - win), hi = Math.min(lb - 1, i + win);
    for (let j = lo; j <= hi; j++) {
      if (!mb[j] && a[i] === b[j]) { ma[i] = mb[j] = 1; m++; break; }
    }
  }
  if (!m) return 0;
  let t = 0;
  for (let i = 0, j = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[j]) j++;
    if (a[i] !== b[j]) t++;
    j++;
  }
  const jaro = (m / la + m / lb + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < 4 && p < la && p < lb && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

// Returns a scorer for one query. Each query word takes its best Jaro-Winkler match
// among the verse's words; every word must clear JW_MIN, and the verse's score is
// the mean of those best matches. Word pairs are memoised, since the Bible's whole
// vocabulary is only a few thousand words.
export function jaroWinklerScorer(query) {
  const words = [...new Set(normalize(query).split(" ").filter(Boolean))];
  const memo = words.map(() => new Map());
  return (text) => {
    const tokens = new Set(normalize(text).split(" "));
    let sum = 0;
    for (let k = 0; k < words.length; k++) {
      let best = 0;
      for (const tok of tokens) {
        let s = memo[k].get(tok);
        if (s === undefined) memo[k].set(tok, (s = jaroWinkler(words[k], tok)));
        if (s > best) best = s;
        if (best === 1) break;
      }
      if (best < JW_MIN) return 0;
      sum += best;
    }
    return words.length ? sum / words.length : 0;
  };
}

// ---------- Levenshtein ----------
// Approximate substring matching (Sellers' variant of the Levenshtein DP): the
// fewest single letter insertions, deletions or substitutions needed to turn the
// query into some stretch of the verse. Score = 1 − edits / query length.
export function levenshteinScorer(query) {
  const q = normalize(query);
  const m = q.length;
  const qc = Array.from(q, (ch) => ch.charCodeAt(0));
  let prev = new Int32Array(m + 1), cur = new Int32Array(m + 1);
  return (text) => {
    if (!m) return 0;
    const t = normalize(text);
    for (let i = 0; i <= m; i++) prev[i] = i;
    let best = m;
    for (let j = 0; j < t.length; j++) {
      const c = t.charCodeAt(j);
      cur[0] = 0; // a match may start anywhere in the verse
      for (let i = 1; i <= m; i++) {
        const sub = prev[i - 1] + (qc[i - 1] === c ? 0 : 1);
        const del = prev[i] + 1;
        const ins = cur[i - 1] + 1;
        cur[i] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
      }
      if (cur[m] < best) best = cur[m];
      [prev, cur] = [cur, prev];
    }
    const score = 1 - best / m;
    return score >= LEV_MIN ? score : 0;
  };
}

export const scorerFor = (query) =>
  modeFor(query) === "jaro-winkler" ? jaroWinklerScorer(query) : levenshteinScorer(query);
