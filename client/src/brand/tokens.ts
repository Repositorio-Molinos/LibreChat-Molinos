/**
 * Molinos brand defaults. Values here are the fallback when
 * `startupConfig.interface.brand` is empty. Override per-deployment via
 * BRAND_* env vars in the backend (see api/server/routes/config.js).
 *
 * To revert this fork to vanilla LibreChat visuals, set every default
 * below to `undefined` (or simply delete this file's exports).
 */
export const brandDefaults = {
  logoSidebar: '/assets/logo-molinos-blanco.png' as string | undefined,
  logos: ['/assets/logo-lucchettineta.png', '/assets/logo-molinos-blanco.png'] as
    | string[]
    | undefined,
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
