/**
 * Modal opened from the onboarding wizard's "Médecin" step to invite an
 * associate doctor. Posts to `/api/admin/users` with the MEDECIN role and
 * the V040 practitioner credentials in a single round-trip.
 *
 * Faithful to the prototype's `OnboardingAjouterMedecin` modal (cream
 * variant — `_bundle-register/.../onboarding.jsx:959-1124`), simplified for
 * MVP: civilité picker + permissions selector deferred to BACKLOG.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useCreateUser } from '@/features/parametres/hooks/useUsers';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  specialty: '',
  inpe: '',
  cnom: '',
  cnops: '',
};

export function AddDoctorModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [form, setForm] = useState(EMPTY_FORM);
  const { createUser, isPending } = useCreateUser();

  function setField<K extends keyof typeof EMPTY_FORM>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email || form.password.length < 12) {
      toast.error(t('onboarding.addDoctor.required'));
      return;
    }
    try {
      const payload: import('@/features/parametres/hooks/useUsers').CreateUserForm = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        roles: ['MEDECIN'],
      };
      if (form.specialty) payload.specialty = form.specialty;
      if (form.inpe) payload.inpe = form.inpe;
      if (form.cnom) payload.cnom = form.cnom;
      if (form.cnops) payload.cnops = form.cnops;
      await createUser(payload);
      toast.success(t('onboarding.addDoctor.added', { name: `${form.firstName} ${form.lastName}` }));
      onClose();
    } catch (err) {
      const p = toProblemDetail(err);
      toast.error(p.title, p.detail ? { description: p.detail } : undefined);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('onboarding.addDoctor.aria')}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 27, 22, 0.42)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(720px, 92vw)',
          maxHeight: '90vh',
          background: 'var(--surface)',
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(31,27,22,0.28), 0 4px 14px rgba(31,27,22,0.10)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink)',
        }}
      >
        <div
          style={{
            padding: '22px 28px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="4" />
              <path d="M2 21c0-3.9 3.1-7 7-7" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>
              {t('onboarding.addDoctor.title')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.5 }}>
              {t('onboarding.addDoctor.sub')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('onboarding.close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--ink-3)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="scroll" style={{ padding: '20px 28px', overflowY: 'auto', flex: 1 }}>
          <SectionLabel>{t('onboarding.addDoctor.identity')}</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.firstName')}</FieldLabel>
              <Input value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.lastName')}</FieldLabel>
              <Input value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.email')}</FieldLabel>
              <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="r.bennani@cabinet.ma" />
            </Field>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.phone')}</FieldLabel>
              <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+212 6.." />
            </Field>
          </div>

          <SectionLabel>{t('onboarding.addDoctor.passwordSection')}</SectionLabel>
          <Field>
            <FieldLabel>{t('onboarding.addDoctor.password')}</FieldLabel>
            <Input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} />
          </Field>

          <div style={{ marginTop: 18 }}>
            <SectionLabel>{t('onboarding.addDoctor.credSection')}</SectionLabel>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.specialty')}</FieldLabel>
              <Input value={form.specialty} onChange={(e) => setField('specialty', e.target.value)} placeholder="Cardiologie" />
            </Field>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.inpe')}</FieldLabel>
              <Input value={form.inpe} onChange={(e) => setField('inpe', e.target.value)} placeholder="18 / 924 / 22" />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.cnom')}</FieldLabel>
              <Input value={form.cnom} onChange={(e) => setField('cnom', e.target.value)} placeholder="CNOM-10247-CASA" />
            </Field>
            <Field>
              <FieldLabel>{t('onboarding.addDoctor.cnops')}</FieldLabel>
              <Input value={form.cnops} onChange={(e) => setField('cnops', e.target.value)} placeholder="2022-CARD-3914" />
            </Field>
          </div>
        </div>

        <div
          style={{
            padding: '14px 28px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={isPending}>
            {isPending ? t('onboarding.addDoctor.submitting') : t('onboarding.addDoctor.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--ink-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontWeight: 600,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
