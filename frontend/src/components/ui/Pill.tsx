import type { HTMLAttributes, ReactNode } from 'react';

export type PillStatus = 'arrived' | 'waiting' | 'vitals' | 'consult' | 'done' | 'allergy';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  status?: PillStatus;
  dot?: boolean;
  children: ReactNode;
}

export function Pill({ status, dot = false, className, children, ...rest }: PillProps) {
  const classes = ['pill', status, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {dot && <span className="dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
