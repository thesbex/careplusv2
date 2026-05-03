/**
 * QuickVitalsDialog — saisie rapide des constantes depuis la consultation.
 * Utile quand le patient n'est pas passé par "Salle d'attente → Prise de
 * constantes" (création ad-hoc d'un dossier puis consultation directe).
 *
 * POST /appointments/{id}/vitals — même endpoint que l'écran complet.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';

interface QuickVitalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  appointmentId: string | null;
  patientId: string | undefined;
}

interface FormState {
  systolicMmhg: string;
  diastolicMmhg: string;
  heartRateBpm: string;
  spo2Percent: string;
  temperatureC: string;
  weightKg: string;
  heightCm: string;
}

const EMPTY: FormState = {
  systolicMmhg: '',
  diastolicMmhg: '',
  heartRateBpm: '',
  spo2Percent: '',
  temperatureC: '',
  weightKg: '',
  heightCm: '',
};

function toNumOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function QuickVitalsDialog({
  open, onOpenChange, consultationId, appointmentId, patientId,
}: QuickVitalsDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  function field<K extends keyof FormState>(k: K) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((s) => ({ ...s, [k]: e.target.value })),
    };
  }

  async function handleSave() {
    const payload = {
      systolicMmhg: toNumOrNull(form.systolicMmhg),
      diastolicMmhg: toNumOrNull(form.diastolicMmhg),
      heartRateBpm: toNumOrNull(form.heartRateBpm),
      spo2Percent: toNumOrNull(form.spo2Percent),
      temperatureC: toNumOrNull(form.temperatureC),
      weightKg: toNumOrNull(form.weightKg),
      heightCm: toNumOrNull(form.heightCm),
    };
    if (Object.values(payload).every((v) => v === null)) {
      toast.error('Renseignez au moins une constante.');
      return;
    }
    setIsSubmitting(true);
    try {
      // Préfère l'endpoint consultation (couvre les consultations ad-hoc
      // sans rendez-vous) ; le backend rattachera quand-même l'appointmentId
      // s'il existe sur la consultation.
      const url = appointmentId
        ? `/appointments/${appointmentId}/vitals`
        : `/consultations/${consultationId}/vitals`;
      await api.post(url, payload);
      toast.success('Constantes enregistrées.');
      if (patientId) {
        await queryClient.invalidateQueries({ queryKey: ['vitals', patientId] });
      }
      onOpenChange(false);
      setForm(EMPTY);
    } catch (err) {
      const e = err as {
        response?: {
          data?: {
            detail?: string;
            message?: string;
            errors?: { field?: string; defaultMessage?: string; message?: string }[];
          };
        };
      };
      // Spring renvoie { errors: [{ field, defaultMessage }] } pour les
      // validations @Min/@Max — on les regroupe pour aider le médecin à
      // corriger la bonne case.
      const errs = e?.response?.data?.errors ?? [];
      const description = errs.length > 0
        ? errs.map((x) => `${x.field ?? '?'} : ${x.defaultMessage ?? x.message ?? ''}`).join(' · ')
        : (e?.response?.data?.detail ?? e?.response?.data?.message);
      toast.error('Enregistrement refusé', { description });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed', inset: 0,
          background: 'rgba(20,18,12,0.45)', zIndex: 100,
        }} />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 'min(520px, 94vw)',
            background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
            zIndex: 101,
          }}
        >
          <div style={{
            padding: '12px 18px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Dialog.Title style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
              Saisir les constantes
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', padding: 6, borderRadius: 6, lineHeight: 0,
                }}
              >
                <Close />
              </button>
            </Dialog.Close>
          </div>

          <div style={{
            padding: 18,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <Field label="Systolique (mmHg)" hint="20 – 300" {...field('systolicMmhg')} placeholder="120" />
            <Field label="Diastolique (mmHg)" hint="10 – 250" {...field('diastolicMmhg')} placeholder="80" />
            <Field label="FC (bpm)" hint="10 – 300" {...field('heartRateBpm')} placeholder="72" />
            <Field label="SpO₂ (%)" hint="0 – 100" {...field('spo2Percent')} placeholder="98" />
            <Field label="T° (°C)" hint="20,0 – 46,0" {...field('temperatureC')} placeholder="36,8" />
            <Field label="Poids (kg)" hint="0,2 – 500" {...field('weightKg')} placeholder="72,5" />
            <Field label="Taille (cm)" hint="20 – 260" {...field('heightCm')} placeholder="178" />
          </div>

          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8, justifyContent: 'flex-end',
          }}>
            <Dialog.Close asChild>
              <Button type="button" size="sm">Annuler</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              onClick={() => { void handleSave(); }}
            >
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          height: 32, padding: '0 8px',
          border: '1px solid var(--border)', borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13,
          background: 'var(--surface)',
        }}
      />
      {hint && (
        <span style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 500 }}>
          Plage acceptée : {hint}
        </span>
      )}
    </label>
  );
}
