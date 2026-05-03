/**
 * Desktop SOAP editor — 4-section controlled form.
 * Each section is a real <textarea> bound via RHF register. The S/O/A/P
 * sections map to the backend DTO fields:
 *   S (Subjectif)  → motif
 *   O (Objectif)   → examination
 *   A (Analyse)    → diagnosis
 *   P (Plan)       → notes
 *
 * When the consultation is signed, the textareas become read-only.
 */
import type { ComponentType, SVGProps } from 'react';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import * as Icons from '@/components/icons';
import { Button } from '@/components/ui/Button';
import type { ConsultationFormValues } from '../types';

// ── Section block (reusable) ─────────────────────────────────────────────

interface SoapBlockProps {
  letter: string;
  title: string;
  count?: string;
  children: React.ReactNode;
}

function SoapBlock({ letter, title, count, children }: SoapBlockProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span
          aria-hidden="true"
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
        >
          {letter}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        {count && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

interface SoapTextareaProps {
  id: string;
  label: string;
  register: ReturnType<UseFormRegister<ConsultationFormValues>>;
  disabled: boolean;
  error?: string | undefined;
  rows?: number;
  placeholder?: string;
}

function SoapTextarea({
  id,
  label,
  register,
  disabled,
  error,
  rows = 6,
  placeholder,
}: SoapTextareaProps) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        style={{
          width: '100%',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 6,
          background: disabled ? 'var(--surface-2)' : 'var(--surface)',
          color: 'var(--ink)',
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
        {...register}
      />
      {error && (
        <div id={`${id}-err`} style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>
          {error}
        </div>
      )}
    </>
  );
}

// ── Composed editor ─────────────────────────────────────────────────────

interface SoapEditorProps {
  register: UseFormRegister<ConsultationFormValues>;
  errors: FieldErrors<ConsultationFormValues>;
  disabled: boolean;
}

export function SoapEditor({ register, errors, disabled }: SoapEditorProps) {
  return (
    <>
      <SoapBlock letter="S" title="Subjectif — anamnèse">
        <SoapTextarea
          id="soap-subjectif"
          label="Subjectif — anamnèse"
          register={register('subjectif')}
          disabled={disabled}
          error={errors.subjectif?.message}
          placeholder="Motif de consultation, plaintes, histoire de la maladie…"
        />
      </SoapBlock>

      <SoapBlock letter="O" title="Objectif — examen">
        <SoapTextarea
          id="soap-objectif"
          label="Objectif — examen"
          register={register('objectif')}
          disabled={disabled}
          error={errors.objectif?.message}
          placeholder="Examen clinique, constantes, observations…"
        />
      </SoapBlock>

      <SoapBlock letter="A" title="Appréciation — diagnostic">
        <SoapTextarea
          id="soap-analyse"
          label="Appréciation — diagnostic"
          register={register('analyse')}
          disabled={disabled}
          error={errors.analyse?.message}
          rows={4}
          placeholder="Diagnostic principal, diagnostics différentiels…"
        />
      </SoapBlock>

      <SoapBlock letter="P" title="Plan — conduite à tenir">
        <SoapTextarea
          id="soap-plan"
          label="Plan — conduite à tenir"
          register={register('plan')}
          disabled={disabled}
          error={errors.plan?.message}
          placeholder="Prescriptions, examens complémentaires, RDV de suivi…"
        />
      </SoapBlock>
    </>
  );
}

// ── ActionBtn ─────────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: string;
  label: string;
  sub?: string;
  color?: 'primary' | 'default';
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionBtn({ icon, label, sub, color, onClick, disabled }: ActionBtnProps) {
  const Ico = Icons[icon as keyof typeof Icons] as ComponentType<SVGProps<SVGSVGElement>>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: '1px solid var(--border)',
        background: color === 'primary' ? 'var(--primary-soft)' : 'var(--surface)',
        borderColor: color === 'primary' ? 'var(--primary)' : 'var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
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
        {sub && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>{sub}</div>}
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
  onClick?: () => void;
}

export function DocRow({ title, meta, onClick }: DocRowProps) {
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
      <Button variant="ghost" size="sm" iconOnly aria-label="Aperçu" onClick={onClick}>
        <Icons.Eye />
      </Button>
    </div>
  );
}
