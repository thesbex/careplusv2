import type { HTMLAttributes } from 'react';

export type BrandMarkSize = 'sm' | 'md' | 'lg';
export type BrandMarkTone = 'primary' | 'inverted';

interface BrandMarkProps extends HTMLAttributes<HTMLDivElement> {
  size?: BrandMarkSize;
  /**
   * 'primary' = full-colour gradient mark (default for the cream UI).
   * 'inverted' = solid white mark (for dark heroes / footers).
   */
  tone?: BrandMarkTone;
}

const sizePx: Record<BrandMarkSize, number> = {
  sm: 26,
  md: 28,
  lg: 34,
};

/**
 * careplus logo : C-shape + plus glyph in a blue gradient. Inlined SVG
 * so the icon ships in the bundle (no asset roundtrip) and inherits the
 * `aria-hidden` from its container.
 *
 * Ported from design-handoff-v2/_bundle/careplus/project/careplus-logo.svg
 * on 2026-05-10. Each instance gets a deterministic gradient id (so multiple
 * BrandMarks on a page don't collide) by suffixing the size+tone.
 */
export function BrandMark({
  size = 'md',
  tone = 'primary',
  style,
  className,
  ...rest
}: BrandMarkProps) {
  const box = sizePx[size];
  const inverted = tone === 'inverted';
  const gradId = `cp-brand-${size}-${tone}`;
  const cId = `${gradId}-c`;
  const pId = `${gradId}-p`;
  return (
    <div
      className={['cp-brand-mark', className].filter(Boolean).join(' ')}
      style={{
        width: box,
        height: box,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    >
      <svg viewBox="0 0 64 64" width={box} height={box} fill="none">
        {!inverted && (
          <defs>
            <linearGradient id={cId} x1="8" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#6CB6F6" />
              <stop offset="0.55" stopColor="#3A8FEB" />
              <stop offset="1" stopColor="#1B5BC7" />
            </linearGradient>
            <linearGradient id={pId} x1="32" y1="18" x2="32" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#94CBF8" />
              <stop offset="1" stopColor="#2A7CE7" />
            </linearGradient>
          </defs>
        )}
        <path
          d="M48 12 A24 24 0 1 0 48 52"
          stroke={inverted ? '#fff' : `url(#${cId})`}
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M30 21 h6 a2.2 2.2 0 0 1 2.2 2.2 V29 h5.8 a2.2 2.2 0 0 1 2.2 2.2 v3.6 a2.2 2.2 0 0 1 -2.2 2.2 H38.2 v5.8 a2.2 2.2 0 0 1 -2.2 2.2 h-6 a2.2 2.2 0 0 1 -2.2 -2.2 V37 h-5.8 a2.2 2.2 0 0 1 -2.2 -2.2 v-3.6 a2.2 2.2 0 0 1 2.2 -2.2 H27.8 V23.2 A2.2 2.2 0 0 1 30 21 Z"
          fill={inverted ? '#fff' : `url(#${pId})`}
        />
      </svg>
    </div>
  );
}
