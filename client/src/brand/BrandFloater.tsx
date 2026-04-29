import { useBrand } from './useBrand';

/**
 * Decorative floating image anchored to the chat form.
 * `variant="fixed"` for landing (stays at viewport bottom),
 * `variant="absolute"` for active conversations (stays above input).
 */
export default function BrandFloater({ variant }: { variant: 'fixed' | 'absolute' }) {
  const { landingImages } = useBrand();
  const src = landingImages?.[0];
  if (!src) {
    return null;
  }

  const positioning =
    variant === 'fixed' ? 'fixed bottom-0 right-[-40px]' : 'absolute bottom-full right-[-40px]';

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      data-brand-floater={variant}
      className={`pointer-events-none z-10 h-36 w-auto object-contain drop-shadow-xl sm:h-44 ${positioning}`}
      draggable={false}
    />
  );
}
