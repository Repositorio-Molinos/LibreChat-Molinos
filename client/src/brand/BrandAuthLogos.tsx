import type { ReactNode } from 'react';
import { useBrand } from './useBrand';

/**
 * Renders the row of brand logos shown in the auth screen header.
 * Falls back to the upstream `<img>` if no brand logos configured.
 */
export default function BrandAuthLogos({ fallback }: { fallback: ReactNode }) {
  const { logos } = useBrand();
  if (!logos || logos.length === 0) {
    return <>{fallback}</>;
  }
  return (
    <div className="relative z-10 mt-[20px] flex items-center justify-center gap-4">
      {logos.map((src, i) => (
        <img
          key={src}
          src={src}
          className="h-12 w-auto object-contain"
          alt={`brand-logo-${i}`}
          draggable={false}
        />
      ))}
    </div>
  );
}
