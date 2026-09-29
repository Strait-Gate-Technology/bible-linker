// Line breaks are measured once at rest and then pinned with a literal <br>, so
// growing a hovered verse (or animating one) never reflows the paragraph around
// it. Both VerseFocus (on load/resize) and ColumnResize (while dragging) share
// this so there's exactly one definition of "frozen".

export function unfreezeLines() {
  document.querySelectorAll(".reader br[data-freeze]").forEach((b) => b.remove());
  document.querySelectorAll(".reader .line.frozen").forEach((p) => p.classList.remove("frozen"));
}

export function freezeLines() {
  const root = document.documentElement;
  root.classList.add("measuring"); // resting size, no transitions, while we measure
  unfreezeLines();

  const lines = [...document.querySelectorAll(".reader .line")];
  const breaks = [];
  for (const p of lines) {
    let lineTop = null;
    for (const w of p.querySelectorAll(".w")) {
      const t = w.getBoundingClientRect().top;
      if (lineTop === null) lineTop = t;
      else if (t > lineTop + 2) {
        breaks.push(w);
        lineTop = t;
      }
    }
  }
  for (const w of breaks) {
    const br = document.createElement("br");
    br.dataset.freeze = "";
    w.before(br);
  }
  lines.forEach((p) => p.classList.add("frozen"));

  void root.offsetWidth; // flush layout before transitions come back
  root.classList.remove("measuring");
}
