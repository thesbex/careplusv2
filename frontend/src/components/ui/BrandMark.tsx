import type { HTMLAttributes } from 'react';

export type BrandMarkSize = 'sm' | 'md' | 'lg';
export type BrandMarkTone = 'primary' | 'inverted';

interface BrandMarkProps extends HTMLAttributes<HTMLDivElement> {
  size?: BrandMarkSize;
  /** 'primary' = blue fill + white letter; 'inverted' = white fill + blue letter (for dark heroes). */
  tone?: BrandMarkTone;
}

const sizePx: Record<BrandMarkSize, { box: number; font: number }> = {
  sm: { box: 26, font: 14 },
  md: { box: 28, font: 15 },
  lg: { box: 34, font: 18 },
};

export function BrandMark({
  size = 'md',
  tone = 'primary',
  style,
  className,
  ...rest
}: BrandMarkProps) {
  const { box, font } = sizePx[size];
  const inverted = tone === 'inverted';
  return (
    <div
      className={['cp-brand-mark', className].filter(Boolean).join(' ')}
      style={{
        width: box,
        height: box,
        background: inverted ? '#fff' : 'var(--primary)',
        color: inverted ? 'var(--primary)' : 'var(--primary-ink)',
        borderRadius: 'var(--r-md)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--font-sans)',
        fontSize: font,
        fontWeight: inverted ? 700 : 400,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    >
      c
    </div>
  );
}
