/**
 * /dashboard — Dashboard hub (mobile 390 px).
 *
 * Layout : KPIs en grille 2 colonnes, sections empilées verticalement,
 * sparkline pleine largeur. Les graphes sont volontairement très simples
 * (CSS bars) — on évite recharts sur viewport étroit pour rester lisible.
 *
 * Le menu mobile expose `/dashboard` via le menu Plus (ParametragePage.mobile).
 */
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { useDashboardClinical } from './hooks/useDashboardClinical';
import { useDashboardAgenda } from './hooks/useDashboardAgenda';
import { useDashboardFinancial } from './hooks/useDashboardFinancial';
import type { ActivityPoint } from './types';
import './dashboard.css';

const TAB_MAP: Record<MobileTab, string> = {
  agenda: '/agenda',
  salle: '/salle',
  patients: '/patients',
  factu: '/facturation',
  menu: '/parametres',
};

const FINANCIAL_ROLES = ['MEDECIN', 'ADMIN'];

function fmtNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-MA').format(n);
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(n)} MAD`;
}

function fmtPct(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${Math.round(ratio * 100)} %`;
}

function pctInt(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return String(Math.round(ratio * 100));
}

function MKpi({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  testId?: string | undefined;
}) {
  return (
    <div data-testid={testId} className="dash-kpi-m">
      <div className="dash-kpi-label-m">{label}</div>
      <div className="dash-kpi-value-m">{value}</div>
      {hint && <div className="dash-kpi-hint-m">{hint}</div>}
    </div>
  );
}

function MSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h2 className="dash-section-h-m">{title}</h2>
      {children}
    </section>
  );
}

function MSparkline({ points, emptyLabel }: { points: ActivityPoint[]; emptyLabel: string }) {
  if (points.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-3)',
          padding: 12,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
        }}
      >
        {emptyLabel}
      </div>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        padding: '12px 14px',
        height: 90,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {points.map((p) => (
        <div
          key={p.date}
          style={{
            flex: 1,
            minWidth: 2,
            height: `${Math.max(4, (p.count / max) * 100)}%`,
            background: p.count > 0 ? 'var(--primary)' : 'var(--border)',
            borderRadius: '2px 2px 0 0',
            opacity: p.count > 0 ? 0.85 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

export default function DashboardPageMobile() {
  const navigate = useNavigate();
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const showFinancial = !!user && FINANCIAL_ROLES.some((r) => user.roles.includes(r));

  const clinical = useDashboardClinical();
  const agenda = useDashboardAgenda();
  const financial = useDashboardFinancial();

  return (
    <MScreen
      tab="menu"
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label={t('dash.back')} onClick={() => navigate('/parametres')} />}
          title={t('dash.title')}
        />
      }
      onTabChange={(t) => navigate(TAB_MAP[t])}
    >
      <div className="mb-pad" style={{ paddingTop: 16 }}>
        <MSection title={t('dash.today')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MKpi
              testId="kpi-patients-actifs"
              label={t('dash.kpi.activePatients')}
              value={fmtNumber(clinical.data?.patientsActifsTotal)}
              hint={
                clinical.data
                  ? t('dash.kpi.activePatientsDelta', { n: fmtNumber(clinical.data.patientsActifs30j) })
                  : undefined
              }
            />
            <MKpi
              testId="kpi-consultations-jour"
              label={t('dash.kpi.consultDay')}
              value={fmtNumber(clinical.data?.consultationsAujourdhui)}
            />
            <MKpi
              testId="kpi-rdv-jour"
              label={t('dash.kpi.rdvDay')}
              value={fmtNumber(agenda.data?.rdvAujourdhui)}
              hint={
                agenda.data
                  ? t('dash.kpi.fillRate', { n: pctInt(agenda.data.tauxRemplissageJour) })
                  : undefined
              }
            />
            {showFinancial && (
              <MKpi
                testId="kpi-ca-jour"
                label={t('dash.kpi.caDay')}
                value={fmtMoney(financial.data?.caJour)}
              />
            )}
          </div>
        </MSection>

        <MSection title={t('dash.activity')}>
          {clinical.data ? (
            <MSparkline points={clinical.data.activite30j} emptyLabel={t('dash.empty.activity')} />
          ) : (
            <div
              style={{
                padding: 12,
                fontSize: 12,
                color: 'var(--ink-3)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
              }}
            >
              {clinical.isLoading ? t('common.loading') : '—'}
            </div>
          )}
        </MSection>

        <MSection title={t('dash.agendaWeek')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MKpi
              testId="kpi-rdv-semaine"
              label={t('dash.kpi.rdvWeek')}
              value={fmtNumber(agenda.data?.rdvSemaine)}
              hint={
                agenda.data
                  ? t('dash.kpi.fillRate', { n: pctInt(agenda.data.tauxRemplissageSemaine) })
                  : undefined
              }
            />
            <MKpi
              testId="kpi-no-shows"
              label={t('dash.kpi.noShows')}
              value={fmtNumber(agenda.data?.noShowsSemaine)}
            />
            <MKpi
              testId="kpi-annulations"
              label={t('dash.kpi.cancellations')}
              value={fmtNumber(agenda.data?.annulationsSemaine)}
            />
            <MKpi
              testId="kpi-nouveaux-patients"
              label={t('dash.kpi.newPatients')}
              value={fmtNumber(agenda.data?.nouveauxPatientsMois)}
            />
          </div>
        </MSection>

        {showFinancial && (
          <MSection title={t('dash.financial')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MKpi
                testId="kpi-ca-mois"
                label={t('dash.kpi.caMonth')}
                value={fmtMoney(financial.data?.caMois)}
              />
              <MKpi
                testId="kpi-ca-ytd"
                label={t('dash.kpi.caYtd')}
                value={fmtMoney(financial.data?.caYTD)}
              />
              <MKpi
                testId="kpi-impayes"
                label={t('dash.kpi.unpaid')}
                value={fmtMoney(financial.data?.impayesTotal)}
                hint={
                  financial.data
                    ? t('dash.kpi.unpaidDelta', { n: fmtNumber(financial.data.impayesCount) })
                    : undefined
                }
              />
              <MKpi
                testId="kpi-encaissement"
                label={t('dash.kpi.collectRate')}
                value={fmtPct(financial.data?.tauxEncaissement)}
              />
            </div>
          </MSection>
        )}

        {(clinical.error || agenda.error || (showFinancial && financial.error)) && (
          <div
            data-testid="dash-errors"
            className="dash-error-banner"
            style={{ marginTop: 8 }}
          >
            {clinical.error || agenda.error || financial.error}
          </div>
        )}
      </div>
    </MScreen>
  );
}
