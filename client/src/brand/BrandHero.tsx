import type { ReactNode } from 'react';
import { useBrand } from './useBrand';

/**
 * Replaces the landing hero icon with a brand image when configured.
 * Renders `fallback` (typically `<ConvoIcon />`) when no brand hero set.
 */
export default function BrandHero({ fallback }: { fallback: ReactNode }) {
  const { heroImage, landingImages } = useBrand();
  const src = heroImage ?? landingImages?.[0];

  if (!src) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="h-full w-full object-contain"
      draggable={false}
    />
  );
}
