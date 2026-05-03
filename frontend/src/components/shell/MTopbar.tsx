import type { ReactNode, MouseEventHandler, ComponentType, SVGProps } from 'react';
import * as Icons from '@/components/icons';
import { BrandMark } from '@/components/ui/BrandMark';

export interface MTopbarProps {
  title?: string;
  sub?: string;
  left?: ReactNode;
  right?: ReactNode;
  brand?: boolean;
}

export function MTopbar({ title, sub, left, right, brand = false }: MTopbarProps) {
  return (
    <div className="mt">
      {brand ? (
        <div className="mt-brand">
          <BrandMark size="sm" />
          <span className="mt-brand-name">careplus</span>
        </div>
      ) : (
        left
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="mt-title">{title}</div>}
        {sub && <div className="mt-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

type IconName = keyof typeof Icons;

interface MIconBtnProps {
  icon: IconName;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  badge?: boolean;
  label: string;
}

export function MIconBtn({ icon, onClick, badge = false, label }: MIconBtnProps) {
  const Ico = Icons[icon] as ComponentType<SVGProps<SVGSVGElement>>;
  return (
    <button
      type="button"
      className="mt-icon"
      onClick={onClick}
      aria-label={label}
      style={{ position: 'relative', border: 0, background: 'transparent', cursor: 'pointer' }}
    >
      <Ico />
      {badge && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            background: 'var(--amber)',
            borderRadius: '50%',
            border: '1.5px solid var(--surface)',
          }}
        />
      )}
    </button>
  );
}
