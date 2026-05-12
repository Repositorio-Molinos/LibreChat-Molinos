import type { CSSProperties } from 'react';

/**
 * Marco decorativo de la pantalla de login: figuras geométricas en las 4
 * esquinas con aspect-ratio fijo (785/441 ≈ 1.78). El aspect-ratio + max-h
 * desde el padre evita que las figuras se recorten en viewports más altos
 * o más anchos que la proporción original — quedan bandas blancas (invisibles
 * porque el bg de la página también es blanco).
 *
 * Los SVG viven en `public/assets/` para que se sirvan directo por Vite y
 * compartan fuente con el favicon / sidebar logo.
 */

type Props = { className?: string };

const FRAME_STYLE: CSSProperties = { aspectRatio: '785 / 441' };
const SHAPE_BASE = 'absolute pointer-events-none select-none object-contain';

export default function BrandDecorativeFrame({ className }: Props) {
  return (
    <div
      className={`relative w-full overflow-hidden bg-white ${className ?? ''}`}
      style={FRAME_STYLE}
    >
      <img
        src="/assets/forma-puntos.svg"
        alt=""
        aria-hidden
        className={SHAPE_BASE}
        style={{ top: '13%', left: '6%', width: '14%', zIndex: 1, transform: 'scaleX(-1)' }}
      />
      <img
        src="/assets/forma-azul.svg"
        alt=""
        aria-hidden
        className={SHAPE_BASE}
        style={{ top: '3%', left: '1.5%', width: '9%', zIndex: 2 }}
      />
      <img
        src="/assets/forma-puntos.svg"
        alt=""
        aria-hidden
        className={SHAPE_BASE}
        style={{
          bottom: '9%',
          left: '2.5%',
          width: '11%',
          zIndex: 1,
          transform: 'scaleY(-1) scaleX(-1)',
        }}
      />
      <img
        src="/assets/forma-amarillo.svg"
        alt=""
        aria-hidden
        className={SHAPE_BASE}
        style={{ bottom: '23%', left: '16.5%', width: '5.5%', zIndex: 2 }}
      />
      <img
        src="/assets/forma-verde.svg"
        alt=""
        aria-hidden
        className={SHAPE_BASE}
        style={{
          bottom: '25%',
          right: '5.5%',
          width: '5.5%',
          zIndex: 2,
          transform: 'scaleY(-1) scaleX(-1)',
        }}
      />
      <img
        src="/assets/forma-rojo.svg"
        alt=""
        aria-hidden
        className={SHAPE_BASE}
        style={{
          bottom: '4%',
          right: '1.5%',
          width: '9%',
          zIndex: 2,
          transform: 'scaleY(-1)',
        }}
      />
    </div>
  );
}
