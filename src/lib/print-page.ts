export type PageOrient = "portrait" | "landscape";

const STYLE_ID = "hysiac-print-orient";

function fitLandscapeBills(): void {
  const bills = document.querySelectorAll<HTMLElement>(".bill-land");
  if (!bills.length) return;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:200mm;width:0;pointer-events:none";
  document.body.appendChild(probe);
  const pagePx = probe.getBoundingClientRect().height || 740;
  probe.remove();
  let onePage = true;
  bills.forEach((node) => {
    node.querySelectorAll<HTMLElement>(".bill-fill").forEach((row) => {
      row.style.display = "none";
    });
    node.style.height = "auto";
    node.style.maxHeight = "none";
    node.style.overflow = "visible";
    const natural = node.scrollHeight;
    node.querySelectorAll<HTMLElement>(".bill-fill").forEach((row) => {
      row.style.display = "";
    });
    if (natural <= pagePx + 2) {
      node.style.height = "200mm";
      node.style.maxHeight = "200mm";
      node.style.overflow = "hidden";
      return;
    }
    onePage = false;
    node.style.height = "auto";
    node.style.maxHeight = "none";
    node.style.overflow = "visible";
    node.style.margin = "4mm";
    node.querySelectorAll(".bill-pad, .bill-fill").forEach((row) => row.remove());
  });
  document.documentElement.classList.toggle("bill-one-page", onePage);
}

function resetBillFit(): void {
  document.querySelectorAll<HTMLElement>(".bill-land").forEach((node) => {
    node.style.height = "";
    node.style.maxHeight = "";
    node.style.overflow = "";
    node.style.margin = "";
  });
  document.documentElement.classList.remove("bill-one-page");
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeprint", fitLandscapeBills);
  window.addEventListener("afterprint", resetBillFit);
}

export function printPage(orient: PageOrient): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.printOrient = orient;
  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_ID;
    document.head.appendChild(tag);
  }
  // `A4 landscape` — a bare size is ignored by Android print and falls back to US Letter.
  const size = orient === "landscape" ? "A4 landscape" : "A4 portrait";
  const margin = orient === "landscape" ? "0" : "8mm";
  const pageH = orient === "landscape" ? "200mm" : "277mm";
  document.documentElement.style.setProperty("--bill-page-h", pageH);
  tag.textContent = `@page { size: ${size}; margin: ${margin}; }`;
  if (orient === "landscape") fitLandscapeBills();
  const bridge = (window as unknown as { HysiacAndroid?: { printPage?: (orient?: string) => void } }).HysiacAndroid;
  if (bridge?.printPage) {
    bridge.printPage(orient);
    window.setTimeout(resetBillFit, 8000);
    return;
  }
  window.print();
}

export function orientLabel(orient: PageOrient): string {
  return orient === "landscape" ? "A4 landscape" : "A4 portrait";
}
