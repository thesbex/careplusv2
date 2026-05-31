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
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Plus } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  STATUS_LABEL_KEY,
  OUTCOME_LABEL_KEY,
  PRESENTATION_LABEL_KEY,
  ULTRASOUND_KIND_LABEL_KEY,
  VISIT_PLAN_STATUS_LABEL_KEY,
  type Pregnancy,
  type Trimester,
} from '../types';
import { useCurrentPregnancy } from '../hooks/useCurrentPregnancy';
import { usePregnancies } from '../hooks/usePregnancies';
import { usePregnancyVisits } from '../hooks/usePregnancyVisits';
import { usePregnancyUltrasounds, downloadUltrasoundCrPdf } from '../hooks/usePregnancyUltrasounds';
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

type Tr = (key: string, vars?: Record<string, string | number>) => string;

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

function PregnancyHeaderStats({ pregnancy, t }: { pregnancy: Pregnancy; t: Tr }) {
  return (
    <div className="gr-header">
      <div className="gr-header-stats">
        <div className="gr-stat">
          <span className="gr-stat-label">{t('gross.stat.saCurrent')}</span>
          <span className="gr-stat-value">
            {pregnancy.saWeeks ?? '—'}
            {pregnancy.saWeeks != null && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 4 }}>
                {t('gross.stat.weeks')} {pregnancy.saDays != null ? `+${pregnancy.saDays}j` : ''}
              </span>
            )}
          </span>
        </div>
        <div className="gr-stat">
          <span className="gr-stat-label">{t('gross.stat.dpa')}</span>
          <span className="gr-stat-value">{fmtDate(pregnancy.dueDate)}</span>
          <span className="gr-stat-sub">
            {pregnancy.dueDateSource === 'ECHO_T1'
              ? t('gross.stat.dpaEchoT1')
              : t('gross.stat.dpaNaegele')}
          </span>
        </div>
        <div className="gr-stat">
          <span className="gr-stat-label">{t('gross.stat.ddr')}</span>
          <span className="gr-stat-value">{fmtDate(pregnancy.lmpDate)}</span>
        </div>
        {pregnancy.gravidity != null && (
          <div className="gr-stat">
            <span className="gr-stat-label">{t('gross.stat.gpav')}</span>
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

function PlanTimeline({ pregnancyId, t }: { pregnancyId: string; t: Tr }) {
  const { plan } = usePregnancyPlan(pregnancyId);
  const byWeeks = new Map(plan.map((p) => [p.targetSaWeeks, p]));

  return (
    <div className="gr-plan" aria-label={t('gross.tab.planAria')}>
      {PLAN_TARGETS.map((sa) => {
        const entry = byWeeks.get(sa);
        const status = entry?.status ?? 'PLANIFIEE';
        return (
          <span
            key={sa}
            className={`gr-plan-chip ${status.toLowerCase()}`}
            title={
              entry
                ? t('gross.tab.planTitle', {
                    label: t(VISIT_PLAN_STATUS_LABEL_KEY[entry.status]),
                    date: fmtDate(entry.targetDate),
                  })
                : t('gross.tab.planNotPlanned', { sa })
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
  const { t } = useT();
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
          aria-label={t('gross.tab.loading')}
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
            {t('gross.tab.emptyDesktop')}
          </div>
          {canDeclare && (
            <Button
              variant="primary"
              onClick={() => setDeclareOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              {t('gross.action.declare')}
            </Button>
          )}
        </div>

        {closed.length > 0 && <ObstetricHistorySection pregnancies={closed} loading={loadingHistory} t={t} />}

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
        t={t}
      />

      <ObstetricHistorySection
        pregnancies={pregnancies.filter((p) => p.id !== pregnancy.id && p.status !== 'EN_COURS')}
        loading={loadingHistory}
        t={t}
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
  t: Tr;
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
  t,
}: CurrentPregnancySectionProps) {
  const { visits } = usePregnancyVisits(pregnancy.id);
  const { ultrasounds } = usePregnancyUltrasounds(pregnancy.id);
  const { alerts } = usePregnancyAlerts(pregnancy.id);

  return (
    <>
      <PregnancyAlertsBanner alerts={alerts} />

      <div className="gr-section">
        <div className="gr-section-title">
          {t('gross.tab.current')}{' '}
          <span className={`gr-status-pill ${pregnancy.status}`}>
            {t(STATUS_LABEL_KEY[pregnancy.status])}
          </span>
        </div>
        <PregnancyHeaderStats pregnancy={pregnancy} t={t} />

        <div style={{ marginTop: 14 }}>
          <PlanTimeline pregnancyId={pregnancy.id} t={t} />
        </div>

        {/* Notes saisies à la déclaration / mise à jour de la grossesse —
            invisibles avant ce fix : le champ existait en BE + DTO + type FE
            mais n'était rendu nulle part dans le dossier. */}
        {pregnancy.notes && pregnancy.notes.trim().length > 0 && (
          <div style={{ marginTop: 14 }}>
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
              {t('gross.tab.note')}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-2)',
                whiteSpace: 'pre-line',
                padding: '8px 12px',
                background: 'var(--surface-2, var(--bg-alt))',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {pregnancy.notes}
            </div>
          </div>
        )}

        <div className="gr-actions" style={{ marginTop: 14 }}>
          {canRecordVisit && (
            <Button variant="primary" size="sm" onClick={onOpenVisit}>
              {t('gross.action.recordVisit')}
            </Button>
          )}
          {canRecordUs && (
            <Button variant="ghost" size="sm" onClick={onOpenUs}>
              {t('gross.action.recordUs')}
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
              {t('gross.action.close')}
            </Button>
          )}
          {showCreateChildCta && canCreateChild && (
            <Button variant="primary" size="sm" onClick={onOpenCreateChild}>
              {t('gross.action.createChild')}
            </Button>
          )}
        </div>
      </div>

      {/* Visits table */}
      <div className="gr-section">
        <div className="gr-section-title">{t('gross.visits.title')}</div>
        {visits.length === 0 ? (
          <div className="gr-empty">{t('gross.visits.empty')}</div>
        ) : (
          <table className="gr-table" aria-label={t('gross.visits.aria')}>
            <thead>
              <tr>
                <th>{t('gross.col.date')}</th>
                <th>{t('gross.col.sa')}</th>
                <th>{t('gross.col.weight')}</th>
                <th>{t('gross.col.ta')}</th>
                <th>{t('gross.col.bcf')}</th>
                <th>{t('gross.col.hu')}</th>
                <th>{t('gross.col.presentation')}</th>
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
                  <td>{v.presentation ? t(PRESENTATION_LABEL_KEY[v.presentation]) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ultrasounds table */}
      <div className="gr-section">
        <div className="gr-section-title">{t('gross.us.title')}</div>
        {ultrasounds.length === 0 ? (
          <div className="gr-empty">{t('gross.us.empty')}</div>
        ) : (
          <table className="gr-table" aria-label={t('gross.us.aria')}>
            <thead>
              <tr>
                <th>{t('gross.us.col.type')}</th>
                <th>{t('gross.col.date')}</th>
                <th>{t('gross.us.col.sa')}</th>
                <th>{t('gross.us.col.findings')}</th>
                <th>{t('gross.us.col.correctsDpa')}</th>
                <th>{t('gross.us.col.report')}</th>
              </tr>
            </thead>
            <tbody>
              {ultrasounds.map((u) => (
                <tr key={u.id}>
                  <td>{t(ULTRASOUND_KIND_LABEL_KEY[u.kind])}</td>
                  <td>{fmtDate(u.performedAt)}</td>
                  <td>
                    {u.saWeeksAtExam}+{u.saDaysAtExam}
                  </td>
                  <td style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.findings ?? '—'}
                  </td>
                  <td>{u.correctsDueDate ? t('gross.us.yes') : '—'}</td>
                  <td>
                    <UltrasoundCrPdfButton pregnancyId={pregnancy.id} ultrasoundId={u.id} t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/**
 * Bouton de téléchargement du compte-rendu PDF d'une échographie.
 * Gère son propre état "en cours" pour éviter les double-clics.
 */
function UltrasoundCrPdfButton({
  pregnancyId,
  ultrasoundId,
  t,
}: {
  pregnancyId: string;
  ultrasoundId: string;
  t: Tr;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      aria-label={t('gross.us.crPdfAria')}
      onClick={() => {
        setBusy(true);
        downloadUltrasoundCrPdf(pregnancyId, ultrasoundId)
          .catch(() => toast.error(t('gross.us.crPdfUnavailable')))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? '…' : t('gross.us.crPdf')}
    </Button>
  );
}

interface ObstetricHistorySectionProps {
  pregnancies: Pregnancy[];
  loading: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function ObstetricHistorySection({ pregnancies, loading, t }: ObstetricHistorySectionProps) {
  return (
    <div className="gr-section" data-testid="obstetric-history">
      <div className="gr-section-title">{t('gross.history.title')}</div>
      {loading ? (
        <div className="gr-empty">{t('common.loading')}</div>
      ) : pregnancies.length === 0 ? (
        <div className="gr-empty">{t('gross.history.empty')}</div>
      ) : (
        <div>
          {pregnancies.map((p) => (
            <div key={p.id} className="gr-history-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {p.outcome ? t(OUTCOME_LABEL_KEY[p.outcome]) : t('gross.history.unknownOutcome')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {t('gross.history.ddrEnd', { ddr: fmtDate(p.lmpDate), end: fmtDate(p.endedAt) })}
                </div>
              </div>
              <span className={`gr-status-pill ${p.status}`}>
                {t(STATUS_LABEL_KEY[p.status])}
              </span>
              {p.childPatientId && (
                <a
                  href={`/patients/${p.childPatientId}`}
                  style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}
                >
                  {t('gross.history.childRecord')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
