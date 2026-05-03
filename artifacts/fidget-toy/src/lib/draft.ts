/**
 * Anonymous Studio draft persistence.
 *
 * Guests have no server account, so any work they do in /studio is kept
 * in localStorage under a single key. When they sign in we offer to
 * promote that draft to a real saved project (handled in Studio.tsx).
 */

const DRAFT_KEY = "clickforge.anon-draft";
const STL_COUNT_KEY = "clickforge.anon-stl-exports";
const MODE_KEY = "clickforge.sidebar-mode";
const PROMOTE_FLAG_KEY = "clickforge.anon-draft-promote-pending";

export interface AnonDraft {
  name: string;
  svgData: string;
  settings: Record<string, unknown>;
  updatedAt: number;
}

export function loadDraft(): AnonDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnonDraft;
    if (!parsed.svgData || typeof parsed.svgData !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: AnonDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota exceeded — silently drop, the in-memory state still works.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(PROMOTE_FLAG_KEY);
  } catch { /* ignore */ }
}

// STL export quota for guests is per browser session (resets when the
// browser tab/window is closed) — so we use sessionStorage rather than
// localStorage. This prevents abuse via single-key clearing while still
// letting a returning visitor try the export flow once again.
export function getAnonStlExportCount(): number {
  try {
    const v = Number(sessionStorage.getItem(STL_COUNT_KEY) ?? "0");
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function incrementAnonStlExportCount(): void {
  try {
    sessionStorage.setItem(
      STL_COUNT_KEY,
      String(getAnonStlExportCount() + 1),
    );
  } catch { /* ignore */ }
}

export function setPromotePending(pending: boolean): void {
  try {
    if (pending) localStorage.setItem(PROMOTE_FLAG_KEY, "1");
    else localStorage.removeItem(PROMOTE_FLAG_KEY);
  } catch { /* ignore */ }
}

export function getPromotePending(): boolean {
  try {
    return localStorage.getItem(PROMOTE_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export type SidebarMode = "simple" | "advanced";

export function loadSidebarMode(defaultMode: SidebarMode = "simple"): SidebarMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "advanced" || v === "simple" ? v : defaultMode;
  } catch {
    return defaultMode;
  }
}

export function saveSidebarMode(mode: SidebarMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch { /* ignore */ }
}
