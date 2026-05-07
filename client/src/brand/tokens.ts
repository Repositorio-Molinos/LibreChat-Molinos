import logoIsoSrc from './assets/molinos-iso.svg';
import logoClaimSrc from './assets/molinos-claim.svg';

export const brandAppTitle = 'Molinos IA';

/**
 * Molinos brand asset registry.
 *
 * Code-driven by design: drop a file under `client/src/brand/assets/`,
 * import it here, and assign to the matching field. No yaml/config change.
 */
export const brandDefaults = {
  logoSidebar: logoIsoSrc as string,
  logos: [logoClaimSrc] as string[],
  background: undefined as string | undefined,
  landingImages: undefined as string[] | undefined,
  heroImage: undefined as string | undefined,
};

export type BrandConfig = {
  logoSidebar?: string;
  logos?: string[];
  background?: string;
  landingImages?: string[];
  heroImage?: string;
};
