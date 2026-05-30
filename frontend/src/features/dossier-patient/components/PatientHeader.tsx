/**
 * PatientHeader — avatar + name + age + CIN + allergy pills.
 * Ported from design/prototype/screens/dossier-patient.jsx lines 20–44.
 */
import { PatientAvatar } from '@/components/ui/PatientAvatar';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Print, Edit, Plus, Warn, Sparkles } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import type { PatientSummary } from '../types';
import { useInsurances } from '../hooks/useInsurances';

interface PatientHeaderProps {
  patient: PatientSummary;
  onEdit?: () => void;
  onPrint?: () => void;
  onNewConsultation?: () => void;
  onAskAi?: () => void;
  isStartingConsult?: boolean;
  isPrinting?: boolean;
}

export function PatientHeader({
  patient,
  onEdit,
  onPrint,
  onNewConsultation,
  onAskAi,
  isStartingConsult,
  isPrinting,
}: PatientHeaderProps) {
  const { t } = useT();
  // V044/coverage-fix — render the actual mutuelle name + policy number from
  // the canonical fields instead of the legacy hard-coded `insurance: '—'`
  // string. Pre-fix this row always read "—" even when the patient had a
  // mutuelle on file (user report 2026-05-17).
  const { insurances } = useInsurances();
  const coverageLabel = formatCoverage(patient, insurances, t);
  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <PatientAvatar
        initials={patient.initials}
        documentId={patient.photoDocumentId ?? null}
        size="lg"
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>
            {patient.tier === 'PREMIUM' && (
              <span title={t('dossier.premiumTitle')} aria-label={t('dossier.premiumTitle')} style={{ marginRight: 6 }}>
                🌟
              </span>
            )}
            {patient.fullName}
          </div>
          <Pill>
            ♂ {patient.sex} · {patient.age} {t('dossier.years')}
          </Pill>
          <Pill>{t('dossier.cin', { cin: patient.cin })}</Pill>
          {patient.tier === 'PREMIUM' && (
            <Pill style={{ background: '#FFF3CD', color: '#7A5A00', borderColor: '#F0DA8C' }}>
              {t('dossier.premium')}
            </Pill>
          )}
        </div>
        <div
          className="tnum"
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 12,
            color: 'var(--ink-3)',
            marginTop: 6,
          }}
        >
          <span>{t('dossier.bornOn', { date: patient.birthDate })}</span>
          <span>{patient.phone}</span>
          <span>{patient.email}</span>
          <span>{t('dossier.bloodGroupShort', { group: patient.bloodGroup })}</span>
          <span>{coverageLabel}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={onPrint} disabled={isPrinting}>
          <Print /> {isPrinting ? t('dossier.preparing') : t('dossier.print')}
        </Button>
        {onEdit && (
          <Button onClick={onEdit}>
            <Edit /> {t('dossier.edit')}
          </Button>
        )}
        {onAskAi && (
          <Button onClick={onAskAi} title={t('dossier.askAiTitle')}>
            <Sparkles /> {t('dossier.askAi')}
          </Button>
        )}
        {onNewConsultation && (
          <Button
            variant="primary"
            onClick={onNewConsultation}
            disabled={isStartingConsult}
          >
            <Plus /> {isStartingConsult ? t('dossier.starting') : t('dossier.newConsultation')}
          </Button>
        )}
      </div>

      {/* Alerts strip */}
      <div
        style={{
          display: 'none',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Pretty-print a patient's mutuelle coverage. Returns "Aucune mutuelle" if
 * the patient has no mutuelleInsuranceId on file. Used by the dossier header
 * and shared with mobile surfaces (export below).
 */
export function formatCoverage(
  patient: Pick<PatientSummary, 'mutuelleInsuranceId' | 'mutuellePolicyNumber'>,
  insurances: { id: string; name: string }[],
  t?: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const tr = t ?? ((k: string) => k);
  if (!patient.mutuelleInsuranceId) return t ? tr('dossier.coverageNone') : 'Aucune mutuelle';
  const name =
    insurances.find((i) => i.id === patient.mutuelleInsuranceId)?.name ??
    (t ? tr('dossier.coverageFallback') : 'Mutuelle');
  return patient.mutuellePolicyNumber
    ? (t ? tr('dossier.coveragePolicy', { name, policy: patient.mutuellePolicyNumber }) : `${name} · N° ${patient.mutuellePolicyNumber}`)
    : name;
}

interface AllergyStripProps {
  patient: PatientSummary;
}

export function AllergyStrip({ patient }: AllergyStripProps) {
  const { t } = useT();
  return (
    <div
      style={{
        padding: '10px 20px',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: 'var(--amber-soft)',
        borderBottom: '1px solid #E8CFA9',
      }}
      role="alert"
      aria-label={t('dossier.allergyKnown')}
    >
      <div
        style={{
          color: 'var(--amber)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        <Warn aria-hidden="true" /> {t('dossier.allergy')}
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>
        {(patient.allergyNotes.split('(')[0] ?? '').trim()}{' '}
        {patient.allergyNotes.includes('(') && (
          <span style={{ color: 'var(--ink-3)' }}>
            ({patient.allergyNotes.split('(')[1] ?? ''}
          </span>
        )}
      </span>
      <div
        style={{ width: 1, height: 16, background: '#E8CFA9', margin: '0 8px' }}
        aria-hidden="true"
      />
      <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
        <span>
          <strong>{t('dossier.atcd')}</strong> {patient.antecedents}
        </span>
        <span style={{ color: 'var(--ink-3)' }}>·</span>
        <span>
          <strong>{t('dossier.chronicTreatment')} :</strong> {patient.chronicTreatment}
        </span>
      </div>
    </div>
  );
}
