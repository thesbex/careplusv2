/**
 * /dashboard — Dashboard hub (desktop).
 *
 * Affiche les KPIs cabinet selon le rôle :
 *  - MEDECIN / ADMIN : clinical + agenda + financial
 *  - SECRETAIRE / ASSISTANT : clinical (sans bloc financial) + agenda
 *
 * Les 3 hooks (`useDashboardClinical`, `useDashboardAgenda`,
 * `useDashboardFinancial`) sont auto-désactivés selon le rôle, donc on
 * affiche/masque simplement les sections sans gating supplémentaire.
 *
 * MVP : pas de graphes, listes simples + cards stylés. Les bibliothèques
 * recharts/d3 sont déjà disponibles ; un éventuel F1.bis ajoutera les
 * courbes/histogrammes (BACKLOG).
 */
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { useDashboardClinical } from './hooks/useDashboardClinical';
import { useDashboardAgenda } from './hooks/useDashboardAgenda';
import { useDashboardFinancial } from './hooks/useDashboardFinancial';
import type {
  ActivityPoint,
  HourlyLoadPoint,
  MonthlyRevenuePoint,
  RevenueByActe,
  TopPathologyEntry,
} from './types';

const NAV_MAP = {
  dashboard: '/dashboard',
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  grossesses: '/grossesses',
  stock: '/stock',
  queueLab: '/queue/lab',
  queueRadio: '/queue/radio',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

const FINANCIAL_ROLES = ['MEDECIN', 'ADMIN'];

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-MA').format(n);
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(n)} MAD`;
}

function formatPct(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${Math.round(ratio * 100)} %`;
}

function formatUpdatedAt(ms: number): string {
  if (!ms) return 'jamais';
  const d = new Date(ms);
  return d.toLocaleTimeString('fr-MA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Building blocks ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string | undefined;
  loading?: boolean | undefined;
  testId?: string | undefined;
}

function KpiCard({ label, value, hint, loading, testId }: KpiCardProps) {
  return (
    <div
      data-testid={testId}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 110,
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--ink-3)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          color: 'var(--ink-1)',
          lineHeight: 1.1,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {loading ? (
          <span
            style={{
              display: 'inline-block',
              width: 64,
              height: 22,
              borderRadius: 4,
              background: 'var(--border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
        ) : (
          value
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{hint}</div>
      )}
    </div>
  );
}

function MiniSparkline({ points }: { points: ActivityPoint[] }) {
  if (points.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 12 }}>
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
        gap: 3,
        padding: '12px 16px',
        height: 110,
      }}
      role="img"
      aria-label={`Activité : ${points.length} jours`}
    >
      {points.map((p) => {
        const ratio = p.count / max;
        return (
          <div
            key={p.date}
            title={`${p.date} : ${p.count} consult.`}
            style={{
              flex: 1,
              minWidth: 4,
              height: `${Math.max(4, ratio * 100)}%`,
              background:
                p.count > 0 ? 'var(--primary)' : 'var(--border)',
              borderRadius: '2px 2px 0 0',
              opacity: p.count > 0 ? 0.85 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
}

function HourlyBars({ points }: { points: HourlyLoadPoint[] }) {
  if (points.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 12 }}>
        Aucun rendez-vous prévu.
      </div>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
        {points.map((p) => (
          <div
            key={p.slotStart}
            title={`${p.slotStart} : ${p.count} RDV`}
            style={{
              flex: 1,
              minWidth: 6,
              height: `${(p.count / max) * 100}%`,
              background: 'var(--primary)',
              borderRadius: '2px 2px 0 0',
              opacity: 0.8,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginTop: 6,
          fontSize: 10,
          color: 'var(--ink-3)',
        }}
      >
        {points.map((p, i) => (
          <div
            key={p.slotStart}
            style={{ flex: 1, textAlign: 'center', minWidth: 6 }}
          >
            {i % Math.max(1, Math.floor(points.length / 6)) === 0 ? p.slotStart : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function HBars({
  rows,
  total,
}: {
  rows: { label: string; value: number; sub?: string }[];
  total?: number;
}) {
  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 16 }}>
        Aucune donnée.
      </div>
    );
  }
  const max = total ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
      }}
    >
      {rows.map((r) => (
        <div key={r.label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--ink-2)',
              marginBottom: 3,
            }}
          >
            <span style={{ fontWeight: 500 }}>{r.label}</span>
            <span style={{ color: 'var(--ink-3)' }}>{r.sub ?? r.value}</span>
          </div>
          <div
            style={{
              height: 6,
              background: 'var(--border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${(r.value / max) * 100}%`,
                height: '100%',
                background: 'var(--primary)',
                opacity: 0.85,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthlyRevenueList({ points }: { points: MonthlyRevenuePoint[] }) {
  if (points.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: 16 }}>
        Aucune donnée sur 12 mois.
      </div>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.amount));
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
        {points.map((p) => (
          <div
            key={p.month}
            title={`${p.month} : ${formatMoney(p.amount)}`}
            style={{
              flex: 1,
              minWidth: 8,
              height: `${(p.amount / max) * 100}%`,
              background: 'var(--primary)',
              borderRadius: '2px 2px 0 0',
              opacity: 0.85,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6, fontSize: 10, color: 'var(--ink-3)' }}>
        {points.map((p) => (
          <div key={p.month} style={{ flex: 1, textAlign: 'center', minWidth: 8 }}>
            {p.month.slice(5)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showFinancial = !!user && FINANCIAL_ROLES.some((r) => user.roles.includes(r));

  const clinical = useDashboardClinical();
  const agenda = useDashboardAgenda();
  const financial = useDashboardFinancial();

  const lastUpdate = Math.max(
    clinical.dataUpdatedAt ?? 0,
    agenda.dataUpdatedAt ?? 0,
    showFinancial ? financial.dataUpdatedAt ?? 0 : 0,
  );

  const topPathologies: TopPathologyEntry[] = clinical.data?.topPathologies ?? [];
  const caParActe: RevenueByActe[] = financial.data?.caParActe ?? [];

  return (
    <Screen
      active="dashboard"
      title="Dashboard"
      sub="Indicateurs cabinet — vue synthétique"
      onNavigate={(id) => {
        const path = NAV_MAP[id as keyof typeof NAV_MAP];
        if (path) navigate(path);
      }}
      topbarRight={
        lastUpdate > 0 ? (
          <span
            style={{ fontSize: 12, color: 'var(--ink-3)' }}
            data-testid="dash-last-update"
          >
            Mise à jour {formatUpdatedAt(lastUpdate)}
          </span>
        ) : undefined
      }
    >
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* ── Section Aujourd'hui ─────────────────────────────────────── */}
        <section data-testid="dash-section-today">
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-2)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: '0 0 12px 0',
            }}
          >
            Aujourd'hui
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: showFinancial
                ? 'repeat(4, 1fr)'
                : 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            <KpiCard
              testId="kpi-patients-actifs"
              label="Patients actifs"
              value={formatNumber(clinical.data?.patientsActifsTotal)}
              hint={
                clinical.data
                  ? `${formatNumber(clinical.data.patientsActifs30j)} sur 30 j`
                  : undefined
              }
              loading={clinical.isLoading && clinical.isEnabled}
            />
            <KpiCard
              testId="kpi-consultations-jour"
              label="Consultations du jour"
              value={formatNumber(clinical.data?.consultationsAujourdhui)}
              hint={
                clinical.data
                  ? `${formatNumber(clinical.data.consultationsSemaine)} cette semaine`
                  : undefined
              }
              loading={clinical.isLoading && clinical.isEnabled}
            />
            <KpiCard
              testId="kpi-rdv-jour"
              label="RDV du jour"
              value={formatNumber(agenda.data?.rdvAujourdhui)}
              hint={
                agenda.data
                  ? `Remplissage : ${formatPct(agenda.data.tauxRemplissageJour)}`
                  : undefined
              }
              loading={agenda.isLoading && agenda.isEnabled}
            />
            {showFinancial && (
              <KpiCard
                testId="kpi-ca-jour"
                label="CA du jour"
                value={formatMoney(financial.data?.caJour)}
                hint={
                  financial.data
                    ? `${formatMoney(financial.data.caMois)} ce mois`
                    : undefined
                }
                loading={financial.isLoading && financial.isEnabled}
              />
            )}
          </div>
        </section>

        {/* ── Section Activité ────────────────────────────────────────── */}
        <section data-testid="dash-section-activity">
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-2)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: '0 0 12px 0',
            }}
          >
            Activité
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr',
              gap: 12,
            }}
          >
            <Panel style={{ padding: 0 }}>
              <PanelHeader>Activité 30 derniers jours</PanelHeader>
              {clinical.data ? (
                <MiniSparkline points={clinical.data.activite30j} />
              ) : (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                  {clinical.isLoading ? 'Chargement…' : '—'}
                </div>
              )}
            </Panel>

            <Panel style={{ padding: 0 }}>
              <PanelHeader>Charge horaire (jour)</PanelHeader>
              {agenda.data ? (
                <HourlyBars points={agenda.data.chargeHoraire} />
              ) : (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                  {agenda.isLoading ? 'Chargement…' : '—'}
                </div>
              )}
            </Panel>

            <Panel style={{ padding: 0 }}>
              <PanelHeader>Top pathologies</PanelHeader>
              {clinical.data && clinical.data.topPathologies.length > 0 ? (
                <HBars
                  rows={topPathologies.slice(0, 5).map((p) => ({
                    label: p.label,
                    value: p.count,
                  }))}
                />
              ) : (
                <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                  {clinical.isLoading ? 'Chargement…' : '—'}
                </div>
              )}
            </Panel>
          </div>
        </section>

        {/* ── Section Agenda ──────────────────────────────────────────── */}
        <section data-testid="dash-section-agenda">
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink-2)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              margin: '0 0 12px 0',
            }}
          >
            Agenda — semaine
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            <KpiCard
              testId="kpi-rdv-semaine"
              label="RDV semaine"
              value={formatNumber(agenda.data?.rdvSemaine)}
              hint={
                agenda.data
                  ? `Remplissage : ${formatPct(agenda.data.tauxRemplissageSemaine)}`
                  : undefined
              }
              loading={agenda.isLoading && agenda.isEnabled}
            />
            <KpiCard
              testId="kpi-no-shows"
              label="No-shows"
              value={formatNumber(agenda.data?.noShowsSemaine)}
              loading={agenda.isLoading && agenda.isEnabled}
            />
            <KpiCard
              testId="kpi-annulations"
              label="Annulations"
              value={formatNumber(agenda.data?.annulationsSemaine)}
              loading={agenda.isLoading && agenda.isEnabled}
            />
            <KpiCard
              testId="kpi-nouveaux-patients"
              label="Nouveaux patients (mois)"
              value={formatNumber(agenda.data?.nouveauxPatientsMois)}
              loading={agenda.isLoading && agenda.isEnabled}
            />
          </div>
        </section>

        {/* ── Section Performance financière (MEDECIN/ADMIN) ─────────── */}
        {showFinancial && (
          <section data-testid="dash-section-financial">
            <h2
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink-2)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                margin: '0 0 12px 0',
              }}
            >
              Performance financière
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <KpiCard
                testId="kpi-ca-mois"
                label="CA du mois"
                value={formatMoney(financial.data?.caMois)}
                hint={
                  financial.data
                    ? `vs ${formatMoney(financial.data.caMoisN1)} (n-1)`
                    : undefined
                }
                loading={financial.isLoading && financial.isEnabled}
              />
              <KpiCard
                testId="kpi-ca-ytd"
                label="CA YTD"
                value={formatMoney(financial.data?.caYTD)}
                loading={financial.isLoading && financial.isEnabled}
              />
              <KpiCard
                testId="kpi-impayes"
                label="Impayés"
                value={formatMoney(financial.data?.impayesTotal)}
                hint={
                  financial.data
                    ? `${formatNumber(financial.data.impayesCount)} facture${
                        (financial.data.impayesCount ?? 0) > 1 ? 's' : ''
                      }`
                    : undefined
                }
                loading={financial.isLoading && financial.isEnabled}
              />
              <KpiCard
                testId="kpi-encaissement"
                label="Taux d'encaissement"
                value={formatPct(financial.data?.tauxEncaissement)}
                loading={financial.isLoading && financial.isEnabled}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
              <Panel style={{ padding: 0 }}>
                <PanelHeader>CA 12 derniers mois</PanelHeader>
                {financial.data ? (
                  <MonthlyRevenueList points={financial.data.ca12Mois} />
                ) : (
                  <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                    {financial.isLoading ? 'Chargement…' : '—'}
                  </div>
                )}
              </Panel>
              <Panel style={{ padding: 0 }}>
                <PanelHeader>CA par acte (mois courant)</PanelHeader>
                {financial.data && caParActe.length > 0 ? (
                  <HBars
                    rows={caParActe.slice(0, 6).map((a) => ({
                      label: a.label || a.acteCode,
                      value: a.amount,
                      sub: `${formatMoney(a.amount)} · ${a.count}×`,
                    }))}
                  />
                ) : (
                  <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>
                    {financial.isLoading ? 'Chargement…' : '—'}
                  </div>
                )}
              </Panel>
            </div>
          </section>
        )}

        {/* ── Errors (sous-jacents : afficher discrètement) ───────────── */}
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
            }}
          >
            {clinical.error || agenda.error || financial.error}
          </div>
        )}
      </div>
    </Screen>
  );
}
