"use client";

import { VERSIONS, VERSION_COOKIE, DEFAULT_VERSION, versionOf } from "../lib/versions";

// Bible version picker, leftmost in the toolbar. The choice lives in a cookie so the
// server renders the right text straight away; changing it reloads the page, which replays the reveal in the new text.
export default function VersionSelect({ current }) {
  const v = versionOf(current);

  const change = (e) => {
    const next = e.target.value;
    document.cookie = next === DEFAULT_VERSION
      ? `${VERSION_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${VERSION_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <label className="pick version" title={v.name}>
      <span className="sr">Bible version</span>
      <select value={v.id} onChange={change}>
        {VERSIONS.map((x) => (
          <option key={x.id} value={x.id}>{x.label}</option>
        ))}
      </select>
    </label>
  );
}
