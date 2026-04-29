/**
 * Molinos brand asset registry.
 *
 * Code-driven by design: when marketing delivers an asset (logo, hero, bg),
 * drop the file under `client/src/brand/assets/`, import it here, and assign
 * the import to the matching field below. No yaml/config change required.
 *
 * Example once an asset arrives:
 *   import logoSidebarSrc from './assets/logo-molinos.svg';
 *   export const brandDefaults = { logoSidebar: logoSidebarSrc, ... };
 */
export const brandDefaults = {
  logoSidebar: undefined as string | undefined,
  logos: undefined as string[] | undefined,
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
