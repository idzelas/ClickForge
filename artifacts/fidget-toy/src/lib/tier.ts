import { useUser } from "../lib/auth";

/**
 * Beta override: while billing is not wired up, every signed-in user is
 * treated as Premium. Flip this single constant to `false` to enable the
 * Free tier behaviour everywhere (gates appear on premium controls and
 * the 4-project save limit kicks in).
 */
export const BETA_AUTO_PREMIUM = true;

export type Tier = "guest" | "free" | "premium";

export function useTier(): Tier {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return "guest";
  if (!isSignedIn) return "guest";
  return BETA_AUTO_PREMIUM ? "premium" : "free";
}

export type GatedFeature =
  | "raster_upload"
  | "export_3mf"
  | "export_obj"
  | "save_over_limit"
  | "key_ring"
  | "mirror_shell"
  | "fit_check"
  | "x_ray";

export const FREE_PROJECT_LIMIT = 3;

export const GATED_FEATURE_LABELS: Record<GatedFeature, string> = {
  raster_upload: "Convert images (PNG / JPG / WebP) to SVG",
  export_3mf: "Export to 3MF",
  export_obj: "Export to OBJ",
  save_over_limit: `Save more than ${FREE_PROJECT_LIMIT} projects`,
  key_ring: "Key ring lug",
  mirror_shell: "Mirror left-right",
  fit_check: "Fit-check preview",
  x_ray: "X-ray preview",
};

export function isPremiumOrAbove(tier: Tier): boolean {
  return tier === "premium";
}
