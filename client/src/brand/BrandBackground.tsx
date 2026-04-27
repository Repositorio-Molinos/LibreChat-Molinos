import type { ReactNode } from 'react';
import { useBrand } from './useBrand';

/**
 * Wraps auth pages with the brand background image and overlay.
 * If no brand background configured, renders children with the upstream
 * default surface classes.
 */
export default function BrandBackground({ children }: { children: ReactNode }) {
  const { background } = useBrand();

  if (!background) {
    return (
      <div className="relative flex min-h-screen flex-col bg-white dark:bg-gray-900">
        {children}
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      {children}
    </div>
  );
}
