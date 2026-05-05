import { useBrand } from './useBrand';

/**
 * Sidebar / header brand isotype. Renders the Molinos iso SVG inside a
 * white tile so the red lithography reads cleanly on both light and dark
 * surfaces. Falls back to a red "M" tile if no asset is registered.
 */
export default function BrandLogo({
  className = 'h-10 w-10 rounded-xl',
  alt = 'Molinos',
}: {
  className?: string;
  alt?: string;
}) {
  const { logoSidebar } = useBrand();

  if (logoSidebar) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center overflow-hidden bg-white shadow-sm ${className}`}
      >
        <img
          src={logoSidebar}
          alt=""
          aria-hidden="true"
          className="h-[78%] w-[78%] object-contain"
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center bg-[var(--molinos-red)] text-white shadow-sm ${className}`}
    >
      <span className="text-lg font-extrabold leading-none">M</span>
    </div>
  );
}
