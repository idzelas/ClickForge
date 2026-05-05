/**
 * Server-side mirror of the Free/Premium tier rules.
 *
 * Keep `BETA_AUTO_PREMIUM` in sync with the value in
 * `artifacts/fidget-toy/src/lib/tier.ts`.
 */
export const BETA_AUTO_PREMIUM = true;

export const FREE_PROJECT_LIMIT = 3;

/**
 * Hard cap applied to every account regardless of tier to prevent resource
 * exhaustion. Even premium/beta users cannot exceed this count.
 */
export const PREMIUM_PROJECT_LIMIT = 200;

export type ServerTier = "free" | "premium";

export function tierForSignedInUser(): ServerTier {
  return BETA_AUTO_PREMIUM ? "premium" : "free";
}
