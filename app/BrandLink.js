"use client";

import { endSession } from "./searchSession";
import pkg from "../package.json";

// "v0.23" from package.json's "0.23.0", shown small under the logo.
const VERSION = `v${pkg.version.split(".").slice(0, 2).join(".")}`;

// The Bible Linker logo. Mid lookup, it returns to the chapter being read before
// the first search, and ends the lookup: the saved search and its cached results
// are cleared, so "Back to search results…" disappears. Otherwise it goes home.
export default function BrandLink() {
  const go = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let "open in new tab" be
    e.preventDefault();
    window.location.assign(endSession());
  };

  return (
    <a href="/" className="brand" onClick={go}>
      <span>Bible Linker 📚</span>
      <span className="brand-version" aria-label={`version ${VERSION}`}>{VERSION}</span>
    </a>
  );
}
