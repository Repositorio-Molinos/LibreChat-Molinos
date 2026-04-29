import { brandDefaults, type BrandConfig } from './tokens';

/**
 * Returns the static brand asset registry (code-driven).
 *
 * Single-tenant Molinos build — asset URLs ship inside the bundle, no
 * server/yaml configuration involved. To update the visuals, edit
 * `tokens.ts` and rebuild the image. The hook signature is preserved so
 * consumer components stay agnostic to the source.
 */
export function useBrand(): BrandConfig {
  return brandDefaults;
}
