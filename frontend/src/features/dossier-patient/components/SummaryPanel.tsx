/**
 * SummaryPanel — right column with vitals, medications, admin cards.
 * Ported from design/prototype/screens/dossier-patient.jsx lines 133–154
 * (SummaryCard, KV, Med helpers).
 *
 * Bug B5 (2026-05-06) — la carte « Constantes — dernière visite » lisait
 * `patient.lastVitals` qui n'a jamais été peuplé par `usePatient` (toujours
 * `[]` sur les données réelles). Conséquence : les constantes saisies en
 * consultation/SDA n'étaient pas visibles dans le dossier patient. Fix : la
 * carte est maintenant alimentée directement par `usePatientVitalsHistory`
 * (= GET /patients/{id}/vitals, même source que `VitalsEvolutionPanel` de
 * l'onglet Constantes), avec agrégation "dernière valeur non-null par champ"
 * (toutes consultations confondues — utile quand la dernière mesure n'a
 * renseigné que TA, on récupère quand-même le poids de la visite précédente).
 */
import { Panel, PanelHeader } from '@/components/ui/Panel';
import type { PatientSummary } from '../types';
import { usePatientVitalsHistory } from '../hooks/usePatientVitalsHistory';
import { useInsurances } from '../hooks/useInsurances';
import type { VitalsApi } from '@/features/consultation/hooks/useLatestVitals';
import { VitalIcon, type VitalKey } from '@/features/consultation/components/VitalIcon';

interface SummaryPanelProps {
  patient: PatientSummary;
}

const SEVERITY_BG: Record<string, { bg: string; color: string; border: string }> = {
  LEGERE: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  MODEREE: { bg: '#FFF8E1', color: '#E65100', border: '#FFCC80' },
  SEVERE: { bg: '#FFEBEE', color: 'var(--danger)', border: '#EF9A9A' },
};

const ANTECEDENT_LABELS: Record<string, string> = {
  MEDICAL: 'Médical',
  CHIRURGICAL: 'Chirurgical',
  FAMILIAL: 'Familial',
  GYNECO_OBSTETRIQUE: 'Gynéco',
  HABITUS: 'Habitudes',
};

/**
 * Coerce backend BigDecimal → number propre (Jackson sérialise parfois en string).
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

interface SummaryVitalRow {
  k: string;
  v: string;
  warn?: boolean;
  /** Icône préfixe (F3, 2026-05-06). */
  vital?: VitalKey;
}

/**
 * Construit la liste affichée dans la carte « Constantes — dernière visite ».
 * Stratégie : pour chaque mesure, prendre la valeur non-null la plus récente
 * dans l'historique. Permet d'afficher des constantes anciennes (ex. taille)
 * même quand la dernière visite n'a saisi que la TA. Renvoie une liste vide
 * si aucune mesure n'existe pour ce patient.
 */
function buildLastVitals(history: VitalsApi[]): {
  rows: SummaryVitalRow[];
  asOf: string | null;
} {
  if (history.length === 0) return { rows: [], asOf: null };

  // L'historique est fourni en ordre ASC par `usePatientVitalsHistory` ;
  // on le parcourt à l'envers pour trouver la "dernière valeur non-null" par champ.
  const desc = [...history].reverse();
  function lastOf<K extends keyof VitalsApi>(k: K): VitalsApi[K] | null {
    for (const v of desc) {
      const val = v[k];
      if (val != null) return val;
    }
    return null;
  }

  const sys = asNum(lastOf('systolicMmhg'));
  const dia = asNum(lastOf('diastolicMmhg'));
  const fc = asNum(lastOf('heartRateBpm'));
  const fr = asNum(lastOf('respiratoryRateBpm'));
  const temp = asNum(lastOf('temperatureC'));
  const spo2 = asNum(lastOf('spo2Percent'));
  const weight = asNum(lastOf('weightKg'));
  const height = asNum(lastOf('heightCm'));
  const bmi = asNum(lastOf('bmi'));
  const glycemia = asNum(lastOf('glycemiaGPerL'));
  const abdo = asNum(lastOf('abdominalPerimeterCm'));
  const head = asNum(lastOf('headCircumferenceCm'));

  const rows: SummaryVitalRow[] = [];
  if (sys != null && dia != null) {
    rows.push({ vital: 'ta', k: 'TA', v: `${sys} / ${dia} mmHg`, warn: sys >= 130 });
  }
  if (fc != null) rows.push({ vital: 'fc', k: 'FC', v: `${fc} bpm` });
  if (fr != null) rows.push({ vital: 'fr', k: 'FR', v: `${fr} /min` });
  if (temp != null) rows.push({ vital: 'temp', k: 'T°', v: `${temp.toFixed(1).replace('.', ',')} °C` });
  if (spo2 != null) rows.push({ vital: 'spo2', k: 'SpO₂', v: `${spo2}%` });
  if (weight != null) rows.push({ vital: 'poids', k: 'Poids', v: `${weight.toFixed(1).replace('.', ',')} kg` });
  if (height != null) rows.push({ vital: 'taille', k: 'Taille', v: `${height} cm` });
  if (bmi != null) {
    rows.push({
      vital: 'imc',
      k: 'IMC',
      v: `${bmi.toFixed(1).replace('.', ',')} kg/m²`,
      warn: bmi >= 25 || bmi < 18.5,
    });
  }
  if (glycemia != null) {
    rows.push({ vital: 'glycemie', k: 'Glycémie', v: `${glycemia.toFixed(2).replace('.', ',')} g/L` });
  }
  if (abdo != null) rows.push({ vital: 'abdo', k: 'Périm. abdo.', v: `${abdo} cm` });
  if (head != null) rows.push({ vital: 'cranien', k: 'Périm. crânien', v: `${head} cm` });

  // « as of » = la date du dernier enregistrement (peu importe ses champs non-null).
  const last = desc[0]!;
  const asOf = new Date(last.recordedAt).toLocaleDateString('fr-MA');
  return { rows, asOf };
}

export function SummaryPanel({ patient }: SummaryPanelProps) {
  const allergies = patient.allergyDetails ?? [];
  const antecedents = patient.antecedentDetails ?? [];
  const { history, isLoading: vitalsLoading } = usePatientVitalsHistory(patient.id);
  const { rows: vitalsRows, asOf: vitalsAsOf } = buildLastVitals(history);
  const { insurances } = useInsurances();
  const mutuelleName = patient.mutuelleInsuranceId
    ? insurances.find((i) => i.id === patient.mutuelleInsuranceId)?.name ?? null
    : null;
  return (
    <div
      className="scroll"
      style={{
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)',
        overflow: 'auto',
        padding: 16,
      }}
    >
      {/* Allergies */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Allergies</PanelHeader>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allergies.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucune allergie connue.</div>
          )}
          {allergies.map((a) => {
            const sev = SEVERITY_BG[a.severity] ?? SEVERITY_BG.MODEREE!;
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              >
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 550 }}>{a.substance}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: sev.bg,
                    color: sev.color,
                    border: `1px solid ${sev.border}`,
                    fontWeight: 600,
                  }}
                >
                  {a.severity === 'LEGERE'
                    ? 'Légère'
                    : a.severity === 'SEVERE'
                    ? 'Sévère'
                    : 'Modérée'}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Antécédents */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Antécédents</PanelHeader>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {antecedents.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun antécédent.</div>
          )}
          {antecedents.map((a) => (
            <div
              key={a.id}
              style={{
                padding: '6px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 650,
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  marginBottom: 2,
                }}
              >
                {ANTECEDENT_LABELS[a.type] ?? a.type}
              </div>
              <div style={{ fontSize: 12.5 }}>{a.description}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Couverture — always visible. Pre-fix the panel was conditional on a
          mutuelle being set, so a patient with no coverage showed nothing at
          all and the user had to open the edit form to confirm. */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Couverture</PanelHeader>
        <div style={{ padding: '10px 14px', fontSize: 12.5 }}>
          {patient.tier === 'PREMIUM' && (
            <div style={{ marginBottom: 4 }}>🌟 Patient Premium (remise auto)</div>
          )}
          {patient.mutuelleInsuranceId ? (
            <div style={{ color: 'var(--ink-2)' }}>
              {mutuelleName ?? 'Mutuelle'}
              {patient.mutuellePolicyNumber ? ` · N° ${patient.mutuellePolicyNumber}` : ''}
            </div>
          ) : (
            <div style={{ color: 'var(--ink-3)' }}>Aucune mutuelle déclarée</div>
          )}
        </div>
      </Panel>

      {/* Constantes card — alimentée par usePatientVitalsHistory (B5 fix). */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader style={{ display: 'flex' }}>
          <span>Constantes — dernière visite</span>
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 400,
              fontSize: 11,
              color: 'var(--ink-3)',
            }}
          >
            {vitalsAsOf ?? ''}
          </span>
        </PanelHeader>
        <div style={{ padding: '10px 14px' }}>
          {vitalsLoading && vitalsRows.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Chargement…</div>
          )}
          {!vitalsLoading && vitalsRows.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Aucune constante enregistrée.
            </div>
          )}
          {vitalsRows.map((v) => (
            <div
              key={v.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '3px 0',
                fontSize: 12.5,
              }}
            >
              <span
                style={{
                  color: 'var(--ink-3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {v.vital && <VitalIcon vital={v.vital} />}
                {v.k}
              </span>
              <span
                className="tnum"
                style={{
                  fontWeight: 550,
                  color: v.warn ? 'var(--amber)' : 'var(--ink)',
                }}
              >
                {v.v}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Traitement card */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader style={{ display: 'flex' }}>
          <span>Traitement en cours</span>
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 400,
              fontSize: 11,
              color: 'var(--ink-3)',
            }}
          >
            {patient.currentMedicationsSince}
          </span>
        </PanelHeader>
        <div style={{ padding: '10px 14px' }}>
          {patient.currentMedications.map((m) => (
            <div
              key={m.name}
              style={{
                padding: '6px 0',
                borderBottom: '1px dashed var(--border)',
              }}
            >
              <div style={{ fontWeight: 550, fontSize: 12.5 }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.posology}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Consentements card */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Consentements &amp; administratif</PanelHeader>
        <div style={{ padding: '10px 14px' }}>
          {patient.admin.map((a) => (
            <div
              key={a.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
                fontSize: 12.5,
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{a.k}</span>
              <span className="tnum" style={{ fontWeight: 550, color: 'var(--ink)' }}>
                {a.v}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
