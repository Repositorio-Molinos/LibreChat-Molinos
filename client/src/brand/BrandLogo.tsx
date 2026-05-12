import { useBrand } from './useBrand';

/**
 * Sidebar / header brand isotype. Renders the Molinos iso SVG sin contenedor:
 * el SVG es transparente con linotipia roja, contrasta bien sobre el azul
 * institucional del sidebar y sobre superficies claras. Falla a un tile rojo
 * con "M" si no hay asset registrado.
 */
export default function BrandLogo({
  className = 'h-10 w-10',
  alt = 'Molinos',
}: {
  className?: string;
  alt?: string;
}) {
  const { logoSidebar } = useBrand();

  if (logoSidebar) {
    return (
      <img
        src={logoSidebar}
        alt={alt}
        className={`object-contain ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center rounded-xl bg-[var(--molinos-red)] text-white ${className}`}
    >
      <span className="text-lg font-extrabold leading-none">M</span>
    </div>
  );
}
