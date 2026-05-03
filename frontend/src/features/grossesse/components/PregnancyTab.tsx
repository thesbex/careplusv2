/**
 * PregnancyTab (desktop) — onglet "Grossesse" du dossier patient.
 *
 * Sections :
 *   1. Bandeau alertes actives (HTA, BU+, terme dépassé, etc.)
 *   2. "Grossesse en cours" — header SA/DPA/G/P/A/V + plan timeline 8 chips
 *      + actions (Saisir visite / Saisir écho / Bilan T1/T2/T3 / Clôturer
 *      / Créer fiche enfant) + tableaux visites/échos
 *   3. "Antécédents obstétricaux" — grossesses TERMINEE/INTERROMPUE
 *
 * Si aucune grossesse en cours : empty state avec CTA "Déclarer".
 */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import {
  STATUS_LABEL,
  OUTCOME_LABEL,
  PRESENTATION_LABEL,
  ULTRASOUND_KIND_LABEL,
  VISIT_PLAN_STATUS_LABEL,
  type Pregnancy,
  type Trimester,
} from '../types';
import { useCurrentPregnancy } from '../hooks/useCurrentPregnancy';
import { usePregnancies } from '../hooks/usePregnancies';
import { usePregnancyVisits } from '../hooks/usePregnancyVisits';
import { usePregnancyUltrasounds } from '../hooks/usePregnancyUltrasounds';
import { usePregnancyAlerts } from '../hooks/usePregnancyAlerts';
import { usePregnancyPlan } from '../hooks/usePregnancyPlan';
import { PregnancyAlertsBanner } from './PregnancyAlertsBanner';
import { PregnancyDeclareDialog } from './PregnancyDeclareDialog';
import { PregnancyCloseDialog } from './PregnancyCloseDialog';
import { CreateChildDialog } from './CreateChildDialog';
import { PregnancyVisitDrawer } from './PregnancyVisitDrawer';
import { PregnancyUltrasoundDrawer } from './PregnancyUltrasoundDrawer';
import { BioPanelButton } from './BioPanelButton';
import '../grossesse.css';

interface PregnancyTabProps {
  patientId: string;
}

const PLAN_TARGETS: number[] = [12, 20, 26, 30, 34, 36, 38, 40];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PregnancyHeaderStats({ pregnancy }: { pregnancy: Pregnancy }) {
  return (
    <div className="gr-header">
      <div className="gr-header-stats">
        <div className="gr-stat">
          <span className="gr-stat-label">SA actuelle</span>
          <span className="gr-stat-value">
            {pregnancy.saWeeks ?? '—'}
            {pregnancy.saWeeks != null && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>
                sem {pregnancy.saDays != null ? `+${pregnancy.saDays}j` : ''}
              </span>
            )}
          </span>
        </div>
        <div className="gr-stat">
          <span className="gr-stat-label">DPA</span>
          <span className="gr-stat-value">{fmtDate(pregnancy.dueDate)}</span>
          <span className="gr-stat-sub">
            {pregnancy.dueDateSource === 'ECHO_T1' ? 'Corrigée par écho T1' : 'Naegele'}
          </span>
        </div>
        <div className="gr-stat">
          <span className="gr-stat-label">DDR</span>
          <span className="gr-stat-value">{fmtDate(pregnancy.lmpDate)}</span>
        </div>
        {pregnancy.gravidity != null && (
          <div className="gr-stat">
            <span className="gr-stat-label">G / P / A / V</span>
            <span className="gr-stat-value">
              {pregnancy.gravidity ?? 0}/{pregnancy.parity ?? 0}/{pregnancy.abortions ?? 0}/
              {pregnancy.livingChildren ?? 0}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanTimeline({ pregnancyId }: { pregnancyId: string }) {
  const { plan } = usePregnancyPlan(pregnancyId);
  const byWeeks = new Map(plan.map((p) => [p.targetSaWeeks, p]));

  return (
    <div className="gr-plan" aria-label="Plan de visites prénatales">
      {PLAN_TARGETS.map((sa) => {
        const entry = byWeeks.get(sa);
        const status = entry?.status ?? 'PLANIFIEE';
        return (
          <span
            key={sa}
            className={`gr-plan-chip ${status.toLowerCase()}`}
            title={
              entry
                ? `${VISIT_PLAN_STATUS_LABEL[entry.status]} — cible ${fmtDate(entry.targetDate)}`
                : `SA ${sa} — non planifiée`
            }
          >
            SA {sa}
          </span>
        );
      })}
    </div>
  );
}

export function PregnancyTab({ patientId }: PregnancyTabProps) {
  const { pregnancy, isLoading: loadingCurrent } = useCurrentPregnancy(patientId);
  const { pregnancies, isLoading: loadingHistory } = usePregnancies(patientId);

  // RBAC
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canDeclare = roles.some((r) => ['MEDECIN', 'ADMIN'].includes(r));
  const canRecordVisit = roles.some((r) =>
    ['ASSISTANT', 'MEDECIN', 'ADMIN'].includes(r),
  );
  const canRecordUs = canDeclare;
  const canClose = canDeclare;
  const canCreateChild = canDeclare;
  const canPrescribeBio = canDeclare;

  const [declareOpen, setDeclareOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [usOpen, setUsOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);

  if (loadingCurrent) {
    return (
      <div className="gr-tab" data-testid="pregnancy-tab-loading">
        <div
          style={{
            height: 120,
            background: 'var(--bg-alt)',
            borderRadius: 'var(--r-md)',
            animation: 'pulse 1.4s infinite',
          }}
          aria-label="Chargement de la grossesse…"
        />
      </div>
    );
  }

  // ── Empty state — no current pregnancy ─────────────────────────────────
  if (!pregnancy) {
    const closed = pregnancies.filter((p) => p.status !== 'EN_COURS');
    return (
      <div className="gr-tab" data-testid="pregnancy-tab-empty">
        <div className="gr-section" style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 12 }}>
            Pas de grossesse en cours pour cette patiente.
          </div>
          {canDeclare && (
            <Button
              variant="primary"
              onClick={() => setDeclareOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Déclarer une grossesse
            </Button>
          )}
        </div>

        {closed.length > 0 && <ObstetricHistorySection pregnancies={closed} loading={loadingHistory} />}

        <PregnancyDeclareDialog
          patientId={patientId}
          open={declareOpen}
          onOpenChange={setDeclareOpen}
        />
      </div>
    );
  }

  // ── Active pregnancy ───────────────────────────────────────────────────
  const showCreateChildCta =
    pregnancy.status === 'TERMINEE' &&
    pregnancy.outcome === 'ACCOUCHEMENT_VIVANT' &&
    pregnancy.childPatientId == null;

  return (
    <div className="gr-tab" data-testid="pregnancy-tab">
      <CurrentPregnancySection
        pregnancy={pregnancy}
        canRecordVisit={canRecordVisit}
        canRecordUs={canRecordUs}
        canClose={canClose}
        canPrescribeBio={canPrescribeBio}
        canCreateChild={canCreateChild}
        showCreateChildCta={showCreateChildCta}
        onOpenVisit={() => setVisitOpen(true)}
        onOpenUs={() => setUsOpen(true)}
        onOpenClose={() => setCloseOpen(true)}
        onOpenCreateChild={() => setCreateChildOpen(true)}
      />

      <ObstetricHistorySection
        pregnancies={pregnancies.filter((p) => p.id !== pregnancy.id && p.status !== 'EN_COURS')}
        loading={loadingHistory}
      />

      {/* Drawers + dialogs */}
      <PregnancyVisitDrawer pregnancy={pregnancy} open={visitOpen} onOpenChange={setVisitOpen} />
      <PregnancyUltrasoundDrawer pregnancy={pregnancy} open={usOpen} onOpenChange={setUsOpen} />
      <PregnancyCloseDialog
        pregnancyId={pregnancy.id}
        patientId={patientId}
        open={closeOpen}
        onOpenChange={setCloseOpen}
      />
      <CreateChildDialog
        pregnancyId={pregnancy.id}
        patientId={patientId}
        open={createChildOpen}
        onOpenChange={setCreateChildOpen}
      />
    </div>
  );
}

interface CurrentPregnancySectionProps {
  pregnancy: Pregnancy;
  canRecordVisit: boolean;
  canRecordUs: boolean;
  canClose: boolean;
  canPrescribeBio: boolean;
  canCreateChild: boolean;
  showCreateChildCta: boolean;
  onOpenVisit: () => void;
  onOpenUs: () => void;
  onOpenClose: () => void;
  onOpenCreateChild: () => void;
}

function CurrentPregnancySection({
  pregnancy,
  canRecordVisit,
  canRecordUs,
  canClose,
  canPrescribeBio,
  canCreateChild,
  showCreateChildCta,
  onOpenVisit,
  onOpenUs,
  onOpenClose,
  onOpenCreateChild,
}: CurrentPregnancySectionProps) {
  const { visits } = usePregnancyVisits(pregnancy.id);
  const { ultrasounds } = usePregnancyUltrasounds(pregnancy.id);
  const { alerts } = usePregnancyAlerts(pregnancy.id);

  return (
    <>
      <PregnancyAlertsBanner alerts={alerts} />

      <div className="gr-section">
        <div className="gr-section-title">
          Grossesse en cours{' '}
          <span className={`gr-status-pill ${pregnancy.status}`}>
            {STATUS_LABEL[pregnancy.status]}
          </span>
        </div>
        <PregnancyHeaderStats pregnancy={pregnancy} />

        <div style={{ marginTop: 14 }}>
          <PlanTimeline pregnancyId={pregnancy.id} />
        </div>

        <div className="gr-actions" style={{ marginTop: 14 }}>
          {canRecordVisit && (
            <Button variant="primary" size="sm" onClick={onOpenVisit}>
              Saisir visite
            </Button>
          )}
          {canRecordUs && (
            <Button variant="ghost" size="sm" onClick={onOpenUs}>
              Saisir écho
            </Button>
          )}
          {canPrescribeBio &&
            (['T1', 'T2', 'T3'] as Trimester[]).map((t) => (
              <BioPanelButton
                key={t}
                pregnancyId={pregnancy.id}
                trimester={t}
                variant="ghost"
              />
            ))}
          {canClose && pregnancy.status === 'EN_COURS' && (
            <Button variant="ghost" size="sm" onClick={onOpenClose}>
              Clôturer la grossesse
            </Button>
          )}
          {showCreateChildCta && canCreateChild && (
            <Button variant="primary" size="sm" onClick={onOpenCreateChild}>
              Créer la fiche enfant
            </Button>
          )}
        </div>
      </div>

      {/* Visits table */}
      <div className="gr-section">
        <div className="gr-section-title">Visites enregistrées</div>
        {visits.length === 0 ? (
          <div className="gr-empty">Aucune visite enregistrée.</div>
        ) : (
          <table className="gr-table" aria-label="Visites">
            <thead>
              <tr>
                <th>Date</th>
                <th>SA</th>
                <th>Poids</th>
                <th>TA</th>
                <th>BCF</th>
                <th>HU</th>
                <th>Présent.</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>{fmtDateTime(v.recordedAt)}</td>
                  <td>
                    {v.saWeeks}+{v.saDays}
                  </td>
                  <td>{v.weightKg != null ? `${v.weightKg} kg` : '—'}</td>
                  <td>
                    {v.bpSystolic != null && v.bpDiastolic != null
                      ? `${v.bpSystolic}/${v.bpDiastolic}`
                      : '—'}
                  </td>
                  <td>{v.fetalHeartRateBpm != null ? `${v.fetalHeartRateBpm}` : '—'}</td>
                  <td>{v.fundalHeightCm != null ? `${v.fundalHeightCm} cm` : '—'}</td>
                  <td>{v.presentation ? PRESENTATION_LABEL[v.presentation] : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ultrasounds table */}
      <div className="gr-section">
        <div className="gr-section-title">Échographies</div>
        {ultrasounds.length === 0 ? (
          <div className="gr-empty">Aucune échographie enregistrée.</div>
        ) : (
          <table className="gr-table" aria-label="Échographies">
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>SA</th>
                <th>Conclusions</th>
                <th>Corrige DPA</th>
              </tr>
            </thead>
            <tbody>
              {ultrasounds.map((u) => (
                <tr key={u.id}>
                  <td>{ULTRASOUND_KIND_LABEL[u.kind]}</td>
                  <td>{fmtDate(u.performedAt)}</td>
                  <td>
                    {u.saWeeksAtExam}+{u.saDaysAtExam}
                  </td>
                  <td style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.findings ?? '—'}
                  </td>
                  <td>{u.correctsDueDate ? 'Oui' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

interface ObstetricHistorySectionProps {
  pregnancies: Pregnancy[];
  loading: boolean;
}

function ObstetricHistorySection({ pregnancies, loading }: ObstetricHistorySectionProps) {
  return (
    <div className="gr-section" data-testid="obstetric-history">
      <div className="gr-section-title">Antécédents obstétricaux</div>
      {loading ? (
        <div className="gr-empty">Chargement…</div>
      ) : pregnancies.length === 0 ? (
        <div className="gr-empty">Aucun antécédent obstétrical.</div>
      ) : (
        <div>
          {pregnancies.map((p) => (
            <div key={p.id} className="gr-history-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.outcome ? OUTCOME_LABEL[p.outcome] : 'Issue inconnue'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  DDR {fmtDate(p.lmpDate)} — Fin {fmtDate(p.endedAt)}
                </div>
              </div>
              <span className={`gr-status-pill ${p.status}`}>
                {STATUS_LABEL[p.status]}
              </span>
              {p.childPatientId && (
                <a
                  href={`/patients/${p.childPatientId}`}
                  style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
                >
                  Fiche enfant →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
