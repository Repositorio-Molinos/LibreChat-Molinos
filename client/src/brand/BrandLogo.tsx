import { useBrand } from './useBrand';

export default function BrandLogo({
  className = 'h-8 w-auto object-contain',
  alt = 'Logo',
}: {
  className?: string;
  alt?: string;
}) {
  const { logoSidebar } = useBrand();
  if (!logoSidebar) {
    return null;
  }
  return <img src={logoSidebar} alt={alt} className={className} draggable={false} />;
}
