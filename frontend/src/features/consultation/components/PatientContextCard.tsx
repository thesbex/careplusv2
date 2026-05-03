/**
 * Left panel: patient at a glance (live data).
 * Receives patient summary + latest vitals; renders skeleton while loading.
 */
import { Panel } from '@/components/ui/Panel';
import { Warn } from '@/components/icons';
import type { PatientSummary } from '@/features/dossier-patient/types';
import type { VitalsApi } from '../hooks/useLatestVitals';

interface PatientContextCardProps {
  patient: PatientSummary | null;
  vitals: VitalsApi | null;
  onRecordVitals?: () => void;
  canRecordVitals?: boolean;
}

function SectionH({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-3)',
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function VitalRow({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--ink-3)' }}>{k}</span>
      <span className="tnum" style={warn ? { color: 'var(--amber)', fontWeight: 600 } : undefined}>
        {v}
      </span>
    </div>
  );
}

/**
 * Coerce vers un number — tolère les "number-like strings" (Jackson sérialise
 * parfois BigDecimal en string), évite un TypeError sur `.toFixed` si le
 * backend renvoie "36.8" au lieu de 36.8.
 */
function asNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatDecimal(v: unknown, digits: number): string | null {
  const n = asNum(v);
  if (n == null) return null;
  return n.toFixed(digits).replace('.', ',');
}

export function PatientContextCard({
  patient, vitals, onRecordVitals, canRecordVitals = true,
}: PatientContextCardProps) {
  if (!patient) {
    return (
      <div
        className="scroll"
        style={{
          borderRight: '1px solid var(--border)',
          background: 'var(--surface-2)',
          padding: 16,
          overflow: 'auto',
          color: 'var(--ink-3)',
          fontSize: 12,
        }}
      >
        Chargement du patient…
      </div>
    );
  }

  // Affiche `HH:mm` si pris aujourd'hui, sinon `JJ/MM HH:mm` — le médecin doit
  // pouvoir distinguer en un coup d'œil les constantes de la visite courante
  // de celles héritées d'une consultation précédente.
  const vitalsTime = vitals
    ? (() => {
        const d = new Date(vitals.recordedAt);
        const today = new Date();
        const sameDay =
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate();
        const hm = d.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' });
        if (sameDay) return hm;
        const dm = d.toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit' });
        return `${dm} ${hm}`;
      })()
    : null;

  const sys = asNum(vitals?.systolicMmhg);
  const dia = asNum(vitals?.diastolicMmhg);
  const fc = asNum(vitals?.heartRateBpm);
  const tempStr = formatDecimal(vitals?.temperatureC, 1);
  const spo2 = asNum(vitals?.spo2Percent);
  const bmiStr = formatDecimal(vitals?.bmi, 1);

  const ta = sys != null && dia != null ? `${sys} / ${dia}` : null;
  const taWarn = sys != null && sys >= 130;
  const bmiNum = asNum(vitals?.bmi);
  const bmiWarn = bmiNum != null && (bmiNum >= 25 || bmiNum < 18.5);

  return (
    <div
      className="scroll"
      style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--surface-2)',
        padding: 16,
        overflow: 'auto',
      }}
    >
      <div className="cp-avatar lg" style={{ marginBottom: 10 }} aria-hidden="true">
        {patient.initials}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
        {patient.tier === 'PREMIUM' && (
          <span title="Patient Premium" aria-label="Patient Premium" style={{ marginRight: 4 }}>
            🌟
          </span>
        )}
        {patient.fullName}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
        {patient.age} ans · {patient.sex} · {patient.dossierNo}
      </div>

      {patient.allergies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          <span className="pill allergy">
            <Warn aria-hidden="true" /> Allergie : {patient.allergies.join(', ')}
          </span>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SectionH>Constantes {vitalsTime ?? '—'}</SectionH>
          </div>
          {canRecordVitals && onRecordVitals && (
            <button
              type="button"
              onClick={onRecordVitals}
              style={{
                background: 'none', border: '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                padding: '3px 8px', borderRadius: 4, color: 'var(--primary)',
                marginBottom: 6,
              }}
            >
              {vitals ? 'Mettre à jour' : 'Saisir'}
            </button>
          )}
        </div>
        <Panel>
          <div style={{ padding: '10px 12px', fontSize: 12 }}>
            {!vitals && (
              <div style={{ color: 'var(--ink-3)' }}>Aucune constante enregistrée.</div>
            )}
            {vitals && (
              <>
                {ta && <VitalRow k="TA" v={ta} warn={taWarn} />}
                {fc != null && <VitalRow k="FC" v={String(fc)} />}
                {tempStr && <VitalRow k="T°" v={tempStr} />}
                {spo2 != null && <VitalRow k="SpO₂" v={`${spo2}%`} />}
                {bmiStr && <VitalRow k="IMC" v={bmiStr} warn={bmiWarn} />}
              </>
            )}
          </div>
        </Panel>
      </div>

      {patient.antecedents && (
        <div style={{ marginTop: 14 }}>
          <SectionH>Antécédents</SectionH>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>
            {patient.antecedents || 'Aucun'}
          </div>
        </div>
      )}

      {patient.chronicTreatment && (
        <div style={{ marginTop: 14 }}>
          <SectionH>Traitement en cours</SectionH>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>
            {patient.chronicTreatment}
          </div>
        </div>
      )}
    </div>
  );
}
