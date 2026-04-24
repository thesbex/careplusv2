/**
 * VitalFieldLarge — large numeric input card used in the Prise des constantes
 * grid (Étape 1 · Mesures).
 *
 * Matches the card shape in design/prototype/screens/prise-constantes.jsx:
 *   <div class="panel" style={{padding:'12px 14px'}}>
 *     <div> icon + label </div>
 *     <div> large input + unit </div>
 *     <div> norm text </div>
 *   </div>
 *
 * When warn=true the input border and background turn amber, and the icon
 * and norm text render in var(--amber) — matching the TA card in the prototype.
 */
import { forwardRef, type ComponentType, type SVGProps } from 'react';
import type { InputHTMLAttributes } from 'react';
import * as Icons from '@/components/icons';
import { Panel } from '@/components/ui/Panel';
import { Input } from '@/components/ui/Input';

type IconName = keyof typeof Icons;

interface VitalFieldLargeProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Icon key from @/components/icons. */
  icon: IconName;
  /** French label, e.g. "Fréquence cardiaque". */
  label: string;
  /** Unit suffix, e.g. "bpm". */
  unit: string;
  /** Range assessment text, e.g. "Normale". */
  norm: string;
  /** When true renders amber warning style (card border + bg). */
  warn?: boolean | undefined;
  /** Forwarded from RHF fieldState.error.message — may be undefined when the field is valid. */
  errorMessage?: string | undefined;
}

export const VitalFieldLarge = forwardRef<HTMLInputElement, VitalFieldLargeProps>(
  function VitalFieldLarge(
    { icon, label, unit, norm, warn = false, errorMessage, style, ...rest },
    ref,
  ) {
    const Ico = Icons[icon] as ComponentType<SVGProps<SVGSVGElement>>;

    return (
      <Panel style={{ padding: '12px 14px' }}>
        {/* Icon + label row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: warn ? 'var(--amber)' : 'var(--primary)',
          }}
        >
          <Ico />
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 550 }}>
            {label}
          </span>
        </div>

        {/* Input + unit row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
          <Input
            ref={ref}
            className="tnum"
            style={{
              height: 44,
              fontSize: 24,
              fontWeight: 500,
              padding: '0 10px',
              borderColor: warn
                ? 'var(--amber)'
                : errorMessage
                ? 'var(--danger)'
                : 'var(--border)',
              background: warn ? 'var(--amber-soft)' : 'var(--surface)',
              ...style,
            }}
            {...rest}
          />
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{unit}</span>
        </div>

        {/* Norm / error text */}
        <div
          style={{
            fontSize: 10.5,
            color: errorMessage ? 'var(--danger)' : warn ? 'var(--amber)' : 'var(--ink-3)',
            marginTop: 4,
          }}
        >
          {errorMessage ?? norm}
        </div>
      </Panel>
    );
  },
);
