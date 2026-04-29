/**
 * Sidebar brand isotype: red rounded square with white "M" letter.
 * Mirrors the Molinos AI mockup; matches the rail-button shape language so
 * it sits visually with the icon stack below it.
 */
export default function BrandLogo({
  className = 'h-10 w-10 rounded-xl',
  alt = 'Molinos',
}: {
  className?: string;
  alt?: string;
}) {
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
