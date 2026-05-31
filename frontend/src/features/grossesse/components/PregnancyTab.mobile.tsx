/**
 * PregnancyTab (mobile 390 px) — same content as desktop but stacked,
 * collapsibles + bottom-sheet drawers (drawers reuse the desktop components,
 * which are styled responsive via grossesse.css @media query).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { Plus } from '@/components/icons';
import {
  STATUS_LABEL_KEY,
  OUTCOME_LABEL_KEY,
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

interface PregnancyTabMobileProps {
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

export function PregnancyTabMobile({ patientId }: PregnancyTabMobileProps) {
  const { t } = useT();
  const { pregnancy, isLoading } = useCurrentPregnancy(patientId);
  const { pregnancies } = usePregnancies(patientId);
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canDeclare = roles.some((r) => ['MEDECIN', 'ADMIN'].includes(r));
  const canRecordVisit = roles.some((r) => ['ASSISTANT', 'MEDECIN', 'ADMIN'].includes(r));
  const canRecordUs = canDeclare;
  const canClose = canDeclare;
  const canPrescribeBio = canDeclare;

  const [declareOpen, setDeclareOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [usOpen, setUsOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [openSection, setOpenSection] = useState<'visites' | 'echos' | 'historique' | null>(
    'visites',
  );

  if (isLoading) {
    return (
      <div className="gr-tab mobile" data-testid="pregnancy-tab-mobile-loading">
        <div
          style={{
            height: 100,
            background: 'var(--bg-alt)',
            borderRadius: 'var(--r-md)',
          }}
          aria-label={t('gross.tab.loading')}
        />
      </div>
    );
  }

  if (!pregnancy) {
    const closed = pregnancies.filter((p) => p.status !== 'EN_COURS');
    return (
      <div className="gr-tab mobile" data-testid="pregnancy-tab-mobile-empty">
        <div className="gr-section" style={{ textAlign: 'center', padding: '24px 12px' }}>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 12 }}>
            {t('gross.tab.emptyMobile')}
          </div>
          {canDeclare && (
            <button
              type="button"
              className="m-btn primary"
              style={{
                height: 40,
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
              onClick={() => setDeclareOpen(true)}
            >
              <Plus aria-hidden="true" /> {t('gross.action.declareMobile')}
            </button>
          )}
        </div>

        {closed.length > 0 && (
          <MobileHistory pregnancies={closed} t={t} />
        )}

        <PregnancyDeclareDialog
          patientId={patientId}
          open={declareOpen}
          onOpenChange={setDeclareOpen}
        />
      </div>
    );
  }

  const showCreateChildCta =
    pregnancy.status === 'TERMINEE' &&
    pregnancy.outcome === 'ACCOUCHEMENT_VIVANT' &&
    pregnancy.childPatientId == null;

  return (
    <div className="gr-tab mobile" data-testid="pregnancy-tab-mobile">
      <MobileBody
        pregnancy={pregnancy}
        canRecordVisit={canRecordVisit}
        canRecordUs={canRecordUs}
        canClose={canClose}
        canPrescribeBio={canPrescribeBio}
        showCreateChildCta={showCreateChildCta}
        openSection={openSection}
        setOpenSection={setOpenSection}
        onOpenVisit={() => setVisitOpen(true)}
        onOpenUs={() => setUsOpen(true)}
        onOpenClose={() => setCloseOpen(true)}
        onOpenCreateChild={() => setCreateChildOpen(true)}
        t={t}
      />

      <MobileHistory
        pregnancies={pregnancies.filter(
          (p) => p.id !== pregnancy.id && p.status !== 'EN_COURS',
        )}
        t={t}
      />

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

interface MobileBodyProps {
  pregnancy: Pregnancy;
  canRecordVisit: boolean;
  canRecordUs: boolean;
  canClose: boolean;
  canPrescribeBio: boolean;
  showCreateChildCta: boolean;
  openSection: 'visites' | 'echos' | 'historique' | null;
  setOpenSection: (s: 'visites' | 'echos' | 'historique' | null) => void;
  onOpenVisit: () => void;
  onOpenUs: () => void;
  onOpenClose: () => void;
  onOpenCreateChild: () => void;
  t: Tr;
}

function MobileBody({
  pregnancy,
  canRecordVisit,
  canRecordUs,
  canClose,
  canPrescribeBio,
  showCreateChildCta,
  openSection,
  setOpenSection,
  onOpenVisit,
  onOpenUs,
  onOpenClose,
  onOpenCreateChild,
  t,
}: MobileBodyProps) {
  const { visits } = usePregnancyVisits(pregnancy.id);
  const { ultrasounds } = usePregnancyUltrasounds(pregnancy.id);
  const { alerts } = usePregnancyAlerts(pregnancy.id);
  const { plan } = usePregnancyPlan(pregnancy.id);
  const byWeeks = new Map(plan.map((p) => [p.targetSaWeeks, p]));

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

        <div className="gr-header-stats" style={{ flexDirection: 'column', gap: 10 }}>
          <div className="gr-stat">
            <span className="gr-stat-label">{t('gross.stat.saCurrent')}</span>
            <span className="gr-stat-value">
              {pregnancy.saWeeks ?? '—'}
              {pregnancy.saWeeks != null && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {' '}{t('gross.stat.weeks')} +{pregnancy.saDays ?? 0}j
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
        </div>

        <div className="gr-plan" style={{ marginTop: 14 }}>
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 14,
          }}
        >
          {canRecordVisit && (
            <button type="button" className="m-btn primary" onClick={onOpenVisit}>
              {t('gross.action.recordVisitMobile')}
            </button>
          )}
          {canRecordUs && (
            <button type="button" className="m-btn" onClick={onOpenUs}>
              {t('gross.action.recordUsMobile')}
            </button>
          )}
          {canPrescribeBio && (
            <div style={{ display: 'flex', gap: 6 }}>
              {(['T1', 'T2', 'T3'] as Trimester[]).map((tr) => (
                <BioPanelButton
                  key={tr}
                  pregnancyId={pregnancy.id}
                  trimester={tr}
                  variant="ghost"
                />
              ))}
            </div>
          )}
          {canClose && pregnancy.status === 'EN_COURS' && (
            <button type="button" className="m-btn" onClick={onOpenClose}>
              {t('gross.action.closeMobile')}
            </button>
          )}
          {showCreateChildCta && (
            <button type="button" className="m-btn primary" onClick={onOpenCreateChild}>
              {t('gross.action.createChild')}
            </button>
          )}
        </div>
      </div>

      <CollapsibleSection
        label={t('gross.visits.countLabel', { n: visits.length })}
        isOpen={openSection === 'visites'}
        onToggle={() => setOpenSection(openSection === 'visites' ? null : 'visites')}
      >
        {visits.length === 0 ? (
          <div className="gr-empty">{t('gross.visits.emptyShort')}</div>
        ) : (
          visits.map((v) => (
            <div
              key={v.id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border-soft)',
                fontSize: 12.5,
              }}
            >
              <div style={{ fontWeight: 600 }}>
                SA {v.saWeeks}+{v.saDays} — {fmtDate(v.recordedAt)}
              </div>
              <div style={{ color: 'var(--ink-3)' }}>
                {v.bpSystolic != null && v.bpDiastolic != null
                  ? `TA ${v.bpSystolic}/${v.bpDiastolic}`
                  : ''}
                {v.weightKg != null ? ` · ${v.weightKg} kg` : ''}
                {v.fetalHeartRateBpm != null ? ` · BCF ${v.fetalHeartRateBpm}` : ''}
                {v.fundalHeightCm != null ? ` · HU ${v.fundalHeightCm}` : ''}
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      <CollapsibleSection
        label={t('gross.us.countLabel', { n: ultrasounds.length })}
        isOpen={openSection === 'echos'}
        onToggle={() => setOpenSection(openSection === 'echos' ? null : 'echos')}
      >
        {ultrasounds.length === 0 ? (
          <div className="gr-empty">{t('gross.us.emptyShort')}</div>
        ) : (
          ultrasounds.map((u) => (
            <div
              key={u.id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid var(--border-soft)',
                fontSize: 12.5,
              }}
            >
              <div style={{ fontWeight: 600 }}>{t(ULTRASOUND_KIND_LABEL_KEY[u.kind])}</div>
              <div style={{ color: 'var(--ink-3)' }}>
                {fmtDate(u.performedAt)} — SA {u.saWeeksAtExam}+{u.saDaysAtExam}
                {u.correctsDueDate ? ` · ${t('gross.us.dpaCorrected')}` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                <UltrasoundCrPdfButtonMobile
                  pregnancyId={pregnancy.id}
                  ultrasoundId={u.id}
                  t={t}
                />
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>
    </>
  );
}

function UltrasoundCrPdfButtonMobile({
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
    <button
      type="button"
      className="m-btn"
      style={{ height: 32, fontSize: 12 }}
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
    </button>
  );
}

function CollapsibleSection({
  label,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="gr-section">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span className="gr-section-title" style={{ marginBottom: 0 }}>
          {label}
        </span>
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {isOpen ? '▾' : '▸'}
        </span>
      </button>
      {isOpen && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

function MobileHistory({ pregnancies, t }: { pregnancies: Pregnancy[]; t: Tr }) {
  if (pregnancies.length === 0) return null;
  return (
    <div className="gr-section" data-testid="obstetric-history-mobile">
      <div className="gr-section-title">{t('gross.history.title')}</div>
      {pregnancies.map((p) => (
        <div key={p.id} className="gr-history-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {p.outcome ? t(OUTCOME_LABEL_KEY[p.outcome]) : t('gross.history.unknownOutcome')}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
              {t('gross.history.ddrEndMobile', { ddr: fmtDate(p.lmpDate), end: fmtDate(p.endedAt) })}
            </div>
          </div>
          <span className={`gr-status-pill ${p.status}`}>
            {t(STATUS_LABEL_KEY[p.status])}
          </span>
        </div>
      ))}
    </div>
  );
}
