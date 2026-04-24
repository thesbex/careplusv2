import type { HTMLAttributes, ReactNode } from 'react';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <div className={['panel', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

interface PanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function PanelHeader({ className, children, ...rest }: PanelHeaderProps) {
  return (
    <div className={['panel-h', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
