export const brandAppTitle = 'Molinos IA';

/**
 * Molinos brand asset registry.
 *
 * Assets viven en `client/public/assets/` (servidos directo por Vite),
 * de modo que el favicon y los componentes de marca refieran al MISMO
 * archivo y no se desincronicen. Para sumar un asset nuevo, dropealo en
 * `public/assets/` y agregá la ruta absoluta acá.
 */
export const brandDefaults = {
  logoSidebar: '/assets/molinos-iso.svg' as string,
  logos: ['/assets/molinos-claim.svg'] as string[],
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
