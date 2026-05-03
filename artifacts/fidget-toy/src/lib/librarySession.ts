/**
 * One-shot in-memory handoff for "Open in Studio" from the Library page.
 * The Studio reads-and-clears this on mount so the SVG loads as if it were
 * just uploaded. Kept in module state (not localStorage) because it should
 * not survive a hard refresh.
 */

export interface PendingLibrarySvg {
  svgData: string;
  name: string;
}

let pending: PendingLibrarySvg | null = null;

export function setPendingLibrarySvg(p: PendingLibrarySvg) {
  pending = p;
}

export function consumePendingLibrarySvg(): PendingLibrarySvg | null {
  const out = pending;
  pending = null;
  return out;
}
