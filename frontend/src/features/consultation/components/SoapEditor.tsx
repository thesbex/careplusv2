/**
 * Desktop SOAP editor — 4-section block.
 * Ported verbatim from SoapBlock, DiagPill, PlanLine helpers in
 * design/prototype/screens/consultation.jsx.
 *
 * The S and O sections render a textarea with the cursor blink animation.
 * The A section renders DiagPills + "Ajouter un diagnostic" button.
 * The P section renders PlanLines.
 */
import type { ComponentType, SVGProps } from 'react';
import * as Icons from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Close, Plus } from '@/components/icons';
import type { DiagEntry, PlanEntry } from '../types';

// ── SoapBlock ──────────────────────────────────────────────────────────────

interface SoapBlockProps {
  letter: string;
  title: string;
  count?: string;
  text?: string;
  children?: React.ReactNode;
}

export function SoapBlock({ letter, title, count, text, children }: SoapBlockProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            background: 'var(--primary)',
            color: 'white',
            borderRadius: 4,
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
          aria-hidden="true"
        >
          {letter}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        {count && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
            {count}
          </span>
        )}
      </div>
      {text !== undefined && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface)',
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--ink)',
          }}
        >
          {text}
          <span
            style={{
              borderLeft: '1.5px solid var(--primary)',
              marginLeft: 2,
              animation: 'blink 1s infinite',
            }}
            aria-hidden="true"
          >
            &nbsp;
          </span>
        </div>
      )}
      {children !== undefined && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--surface)',
            padding: 12,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── DiagPill ───────────────────────────────────────────────────────────────

interface DiagPillProps {
  code: string;
  label: string;
  onRemove?: () => void;
}

export function DiagPill({ code, label, onRemove }: DiagPillProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'var(--primary-soft)',
        borderRadius: 4,
      }}
    >
      <span className="mono" style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
        {code}
      </span>
      <span style={{ fontSize: 12.5 }}>{label}</span>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        style={{ marginLeft: 'auto' }}
        aria-label={`Supprimer ${label}`}
        onClick={onRemove}
      >
        <Close />
      </Button>
    </div>
  );
}

// ── PlanLine ───────────────────────────────────────────────────────────────

interface PlanLineProps {
  ico: string;
  text: string;
  active?: boolean | undefined;
}

export function PlanLine({ ico, text, active }: PlanLineProps) {
  const Ico = Icons[ico as keyof typeof Icons] as ComponentType<SVGProps<SVGSVGElement>>;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 4,
        background: active ? 'var(--primary-soft)' : 'transparent',
        border: active ? '1px solid var(--primary)' : '1px solid transparent',
      }}
    >
      <span style={{ color: active ? 'var(--primary)' : 'var(--ink-3)' }}>
        <Ico aria-hidden="true" />
      </span>
      <span style={{ fontSize: 12.5, flex: 1 }}>{text}</span>
      {active && (
        <span className="pill consult" style={{ fontSize: 9.5 }}>
          Brouillon
        </span>
      )}
    </div>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: string;
  label: string;
  sub?: string;
  color?: 'primary' | 'default';
}

export function ActionBtn({ icon, label, sub, color }: ActionBtnProps) {
  const Ico = Icons[icon as keyof typeof Icons] as ComponentType<SVGProps<SVGSVGElement>>;
  return (
    <button
      type="button"
      style={{
        border: '1px solid var(--border)',
        background: color === 'primary' ? 'var(--primary-soft)' : 'var(--surface)',
        borderColor: color === 'primary' ? 'var(--primary)' : 'var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
      }}
      aria-label={label}
    >
      <span style={{ color: color === 'primary' ? 'var(--primary)' : 'var(--ink-2)' }}>
        <Ico aria-hidden="true" />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 550 }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>
        )}
      </div>
      <span style={{ color: 'var(--ink-3)' }}>
        <Icons.ChevronRight aria-hidden="true" />
      </span>
    </button>
  );
}

// ── DocRow ─────────────────────────────────────────────────────────────────

interface DocRowProps {
  title: string;
  meta: string;
}

export function DocRow({ title, meta }: DocRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--surface)',
      }}
    >
      <Icons.File aria-hidden="true" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 550 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{meta}</div>
      </div>
      <Button variant="ghost" size="sm" iconOnly aria-label="Aperçu">
        <Icons.Eye />
      </Button>
    </div>
  );
}

// ── Composed SoapEditor ───────────────────────────────────────────────────

interface SoapEditorProps {
  subjectif: string;
  objectif: string;
  diagnoses: DiagEntry[];
  plan: PlanEntry[];
}

export function SoapEditor({ subjectif, objectif, diagnoses, plan }: SoapEditorProps) {
  return (
    <>
      <SoapBlock
        letter="S"
        title="Subjectif — anamnèse"
        count="96 mots"
        text={subjectif}
      />

      <SoapBlock letter="O" title="Objectif — examen" text={objectif} />

      <SoapBlock letter="A" title="Appréciation — diagnostic">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {diagnoses.map((d) => (
            <DiagPill key={d.code} code={d.code} label={d.label} />
          ))}
          <Button size="sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Plus /> Ajouter un diagnostic
          </Button>
        </div>
      </SoapBlock>

      <SoapBlock letter="P" title="Plan — conduite à tenir">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plan.map((p, i) => (
            <PlanLine key={i} ico={p.ico} text={p.text} active={p.active} />
          ))}
        </div>
      </SoapBlock>
    </>
  );
}
