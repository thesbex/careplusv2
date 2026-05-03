import type { HTMLAttributes } from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  initials: string;
  size?: AvatarSize;
}

const sizeClass: Record<AvatarSize, string> = { sm: 'sm', md: '', lg: 'lg' };

export function Avatar({ initials, size = 'md', className, ...rest }: AvatarProps) {
  const trimmed = initials.slice(0, 2).toUpperCase();
  return (
    <div
      className={['cp-avatar', sizeClass[size], className].filter(Boolean).join(' ')}
      aria-hidden="true"
      {...rest}
    >
      {trimmed}
    </div>
  );
}
