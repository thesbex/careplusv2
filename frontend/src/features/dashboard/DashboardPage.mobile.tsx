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
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { useAuthStore } from '@/lib/auth/authStore';
import { useDashboardClinical } from './hooks/useDashboardClinical';
import { useDashboardAgenda } from './hooks/useDashboardAgenda';
import { useDashboardFinancial } from './hooks/useDashboardFinancial';
import type { ActivityPoint } from './types';

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
    <div
      data-testid={testId}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '14px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 78,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink-1)', lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</div>}
    </div>
  );
}

function MSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink-2)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          margin: '0 0 10px 0',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function MSparkline({ points }: { points: ActivityPoint[] }) {
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
        Aucune activité.
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
  const user = useAuthStore((s) => s.user);
  const showFinancial = !!user && FINANCIAL_ROLES.some((r) => user.roles.includes(r));

  const clinical = useDashboardClinical();
  const agenda = useDashboardAgenda();
  const financial = useDashboardFinancial();

  return (
    <MScreen
      tab="menu"
      topbar={<MTopbar title="Dashboard" />}
      onTabChange={(t) => navigate(TAB_MAP[t])}
    >
      <div className="mb-pad" style={{ paddingTop: 16 }}>
        <MSection title="Aujourd'hui">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MKpi
              testId="kpi-patients-actifs"
              label="Patients actifs"
              value={fmtNumber(clinical.data?.patientsActifsTotal)}
              hint={
                clinical.data
                  ? `${fmtNumber(clinical.data.patientsActifs30j)} sur 30 j`
                  : undefined
              }
            />
            <MKpi
              testId="kpi-consultations-jour"
              label="Consult. du jour"
              value={fmtNumber(clinical.data?.consultationsAujourdhui)}
            />
            <MKpi
              testId="kpi-rdv-jour"
              label="RDV du jour"
              value={fmtNumber(agenda.data?.rdvAujourdhui)}
              hint={
                agenda.data
                  ? `Remplissage ${fmtPct(agenda.data.tauxRemplissageJour)}`
                  : undefined
              }
            />
            {showFinancial && (
              <MKpi
                testId="kpi-ca-jour"
                label="CA du jour"
                value={fmtMoney(financial.data?.caJour)}
              />
            )}
          </div>
        </MSection>

        <MSection title="Activité 30 j">
          {clinical.data ? (
            <MSparkline points={clinical.data.activite30j} />
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
              {clinical.isLoading ? 'Chargement…' : '—'}
            </div>
          )}
        </MSection>

        <MSection title="Agenda — semaine">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MKpi
              testId="kpi-rdv-semaine"
              label="RDV semaine"
              value={fmtNumber(agenda.data?.rdvSemaine)}
              hint={
                agenda.data
                  ? `${fmtPct(agenda.data.tauxRemplissageSemaine)} rempli`
                  : undefined
              }
            />
            <MKpi
              testId="kpi-no-shows"
              label="No-shows"
              value={fmtNumber(agenda.data?.noShowsSemaine)}
            />
            <MKpi
              testId="kpi-annulations"
              label="Annulations"
              value={fmtNumber(agenda.data?.annulationsSemaine)}
            />
            <MKpi
              testId="kpi-nouveaux-patients"
              label="Nouveaux patients"
              value={fmtNumber(agenda.data?.nouveauxPatientsMois)}
            />
          </div>
        </MSection>

        {showFinancial && (
          <MSection title="Performance financière">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MKpi
                testId="kpi-ca-mois"
                label="CA mois"
                value={fmtMoney(financial.data?.caMois)}
              />
              <MKpi
                testId="kpi-ca-ytd"
                label="CA YTD"
                value={fmtMoney(financial.data?.caYTD)}
              />
              <MKpi
                testId="kpi-impayes"
                label="Impayés"
                value={fmtMoney(financial.data?.impayesTotal)}
                hint={
                  financial.data
                    ? `${fmtNumber(financial.data.impayesCount)} facture${
                        (financial.data.impayesCount ?? 0) > 1 ? 's' : ''
                      }`
                    : undefined
                }
              />
              <MKpi
                testId="kpi-encaissement"
                label="Taux encaissement"
                value={fmtPct(financial.data?.tauxEncaissement)}
              />
            </div>
          </MSection>
        )}

        {(clinical.error || agenda.error || (showFinancial && financial.error)) && (
          <div
            data-testid="dash-errors"
            style={{
              padding: '10px 14px',
              background: 'var(--danger-soft, #fef2f2)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--r-md)',
              fontSize: 12,
              color: 'var(--danger)',
              marginTop: 8,
            }}
          >
            {clinical.error || agenda.error || financial.error}
          </div>
        )}
      </div>
    </MScreen>
  );
}
