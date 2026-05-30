/**
 * /dashboard — Dashboard hub (desktop).
 *
 * DESIGN REFRESH PILOT (2026-05-27) : nouveau design system « dx » (cartes
 * douces fond bleu-gris, graphes recharts navy, KPI à pastille + delta coloré,
 * listes numérotées), porté sur la maquette cible. Scopé sous `.dx` pour ne pas
 * toucher les autres écrans tant que le pilote n'est pas validé.
 *
 * Rôles : MEDECIN/ADMIN voient clinical+agenda+financial ; SECRETAIRE/ASSISTANT
 * voient clinical+agenda (bloc financier masqué). Hooks auto-désactivés par rôle.
 */
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  Tooltip,
} from 'recharts';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Plus } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { useDashboardClinical } from './hooks/useDashboardClinical';
import { useDashboardAgenda } from './hooks/useDashboardAgenda';
import { useDashboardFinancial } from './hooks/useDashboardFinancial';
import './dashboard.css';
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
  messages: '/messages',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

const FINANCIAL_ROLES = ['MEDECIN', 'ADMIN'];
const DX_NAVY = '#1e4dab';
const DX_NAVY_SOFT = '#dce5f5';

const MONTHS_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-MA').format(n);
}
function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(n);
}
function formatPct(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${Math.round(ratio * 100)}`;
}
function monthLabel(yyyymm: string): string {
  const m = Number(yyyymm.slice(5, 7));
  return MONTHS_FR[m - 1] ?? yyyymm.slice(5);
}
function hourLabel(slot: string): string {
  // "08:00" / "08:00:00" / ISO → garde HH
  const hh = slot.includes('T') ? slot.split('T')[1]?.slice(0, 2) : slot.slice(0, 2);
  return hh ?? slot;
}

// ── KPI card ────────────────────────────────────────────────────────────────

type Tone = 'blue' | 'indigo' | 'amber' | 'green';
type DeltaTone = 'pos' | 'neg' | 'warn' | 'muted';

function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaTone = 'muted',
  dot = 'blue',
  accent = false,
  loading = false,
  testId,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  delta?: string | undefined;
  deltaTone?: DeltaTone | undefined;
  dot?: Tone | undefined;
  accent?: boolean | undefined;
  loading?: boolean | undefined;
  testId?: string | undefined;
}) {
  return (
    <div data-testid={testId} className={`dx-kpi${accent ? ' is-accent' : ''}`}>
      <div className="dx-kpi-top">
        <span className={`dx-dot dx-dot-${dot}`} aria-hidden="true" />
        <span className="dx-kpi-label">{label}</span>
      </div>
      <div className="dx-kpi-val">
        {loading ? (
          <span className="dx-skel" aria-hidden="true" />
        ) : (
          <>
            {value}
            {unit && <span className="dx-kpi-unit">{unit}</span>}
          </>
        )}
      </div>
      {delta && <div className={`dx-kpi-delta dx-${deltaTone}`}>{delta}</div>}
    </div>
  );
}

// ── Cards / charts ────────────────────────────────────────────────────────────

function Card({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dx-card">
      <div className="dx-card-h">
        <div>
          <div className="dx-card-title">{title}</div>
          {sub && <div className="dx-card-sub">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function AreaTrend({ points }: { points: ActivityPoint[] }) {
  const { t } = useT();
  if (points.length === 0) return <div className="dx-empty">{t('dash.empty.activity')}</div>;
  return (
    <div className="dx-chart" style={{ height: 96 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="dxArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DX_NAVY} stopOpacity={0.18} />
              <stop offset="100%" stopColor={DX_NAVY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: DX_NAVY_SOFT }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7ecf3' }}
            labelFormatter={(d) => String(d)}
            formatter={(v) => [`${v} consult.`, '']}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={DX_NAVY}
            strokeWidth={2}
            fill="url(#dxArea)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlyChart({ points }: { points: HourlyLoadPoint[] }) {
  const { t } = useT();
  if (points.length === 0) return <div className="dx-empty">{t('dash.empty.rdv')}</div>;
  const max = Math.max(...points.map((p) => p.count));
  const data = points.map((p) => ({ ...p, h: hourLabel(p.slotStart) }));
  return (
    <div className="dx-chart" style={{ height: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
          <XAxis
            dataKey="h"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#8a94a6' }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'rgba(30,58,138,.05)' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7ecf3' }}
            formatter={(v) => [`${v} RDV`, '']}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((p, i) => (
              <Cell key={i} fill={p.count >= max && max > 0 ? DX_NAVY : p.count > 0 ? '#3b5bb5' : DX_NAVY_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MonthlyChart({ points }: { points: MonthlyRevenuePoint[] }) {
  const { t } = useT();
  if (points.length === 0) return <div className="dx-empty">{t('dash.empty.data12')}</div>;
  const data = points.map((p, i) => ({ ...p, m: monthLabel(p.month), recent: i >= points.length - 3 }));
  return (
    <div className="dx-chart" style={{ height: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
          <XAxis
            dataKey="m"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#8a94a6' }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'rgba(30,58,138,.05)' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e7ecf3' }}
            formatter={(v) => [`${formatMoney(Number(v))} MAD`, '']}
          />
          <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
            {data.map((p, i) => (
              <Cell key={i} fill={p.recent ? DX_NAVY : DX_NAVY_SOFT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankedList({
  rows,
}: {
  rows: { label: string; value: string; pct?: string | undefined }[];
}) {
  const { t } = useT();
  if (rows.length === 0) return <div className="dx-empty">{t('dash.empty.data')}</div>;
  return (
    <ol className="dx-rank">
      {rows.map((r, i) => (
        <li key={r.label + i} className="dx-rank-row">
          <span className="dx-rank-n">{String(i + 1).padStart(2, '0')}</span>
          <span className="dx-rank-label">{r.label}</span>
          <span className="dx-rank-val">{r.value}</span>
          {r.pct && <span className="dx-rank-pct">{r.pct}</span>}
        </li>
      ))}
    </ol>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const showFinancial = !!user && FINANCIAL_ROLES.some((r) => user.roles.includes(r));

  const clinical = useDashboardClinical();
  const agenda = useDashboardAgenda();
  const financial = useDashboardFinancial();

  const todayLabel = (() => {
    const s = new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const topPathologies: TopPathologyEntry[] = clinical.data?.topPathologies ?? [];
  const caParActe: RevenueByActe[] = financial.data?.caParActe ?? [];

  // Activité 30 j : total + tendance (7 derniers jours vs 7 précédents).
  const act = clinical.data?.activite30j ?? [];
  const total30 = act.reduce((s, p) => s + p.count, 0);
  const last7 = act.slice(-7).reduce((s, p) => s + p.count, 0);
  const prev7 = act.slice(-14, -7).reduce((s, p) => s + p.count, 0);
  const trendPct = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 1000) / 10 : null;
  const pathoTotal = topPathologies.reduce((s, p) => s + p.count, 0);

  // CA mois vs n-1.
  const caMois = financial.data?.caMois ?? 0;
  const caN1 = financial.data?.caMoisN1 ?? 0;
  const caDeltaPct = caN1 > 0 ? Math.round(((caMois - caN1) / caN1) * 1000) / 10 : null;

  return (
    <Screen
      active="dashboard"
      title={t('dash.title')}
      sub={todayLabel}
      onNavigate={(id) => {
        const path = NAV_MAP[id as keyof typeof NAV_MAP];
        if (path) navigate(path);
      }}
      topbarRight={
        <Button className="cp-ds2-primary" onClick={() => navigate('/agenda')}>
          <Plus /> {t('dash.newRdv')}
        </Button>
      }
    >
      <div className="dx dash-root">
        {/* ── AUJOURD'HUI ─────────────────────────────────────────────── */}
        <section data-testid="dash-section-today">
          <h2 className="dx-section-h">{t('dash.today')}</h2>
          <div className="dx-grid" style={{ ['--cols' as string]: showFinancial ? 4 : 3 }}>
            <KpiCard
              testId="kpi-patients-actifs"
              dot="blue"
              accent
              label={t('dash.kpi.activePatients')}
              value={formatNumber(clinical.data?.patientsActifsTotal)}
              delta={clinical.data ? t('dash.kpi.activePatientsDelta', { n: formatNumber(clinical.data.patientsActifs30j) }) : undefined}
              loading={clinical.isLoading && clinical.isEnabled}
            />
            <KpiCard
              testId="kpi-consultations-jour"
              dot="indigo"
              label={t('dash.kpi.consultDay')}
              value={formatNumber(clinical.data?.consultationsAujourdhui)}
              delta={clinical.data ? t('dash.kpi.consultWeekDelta', { n: formatNumber(clinical.data.consultationsSemaine) }) : undefined}
              loading={clinical.isLoading && clinical.isEnabled}
            />
            <KpiCard
              testId="kpi-rdv-jour"
              dot="amber"
              label={t('dash.kpi.rdvDay')}
              value={formatNumber(agenda.data?.rdvAujourdhui)}
              delta={agenda.data ? t('dash.kpi.fillRate', { n: formatPct(agenda.data.tauxRemplissageJour) }) : undefined}
              loading={agenda.isLoading && agenda.isEnabled}
            />
            {showFinancial && (
              <KpiCard
                testId="kpi-ca-jour"
                dot="green"
                label={t('dash.kpi.caDay')}
                value={formatMoney(financial.data?.caJour)}
                unit="MAD"
                delta={financial.data ? t('dash.kpi.caMonthDelta', { n: formatMoney(financial.data.caMois) }) : undefined}
                deltaTone="pos"
                loading={financial.isLoading && financial.isEnabled}
              />
            )}
          </div>
        </section>

        {/* ── 2 colonnes : Activité | Performance financière ───────────── */}
        <div className={`dx-main${showFinancial ? '' : ' is-solo'}`}>
          {/* LEFT — Activité */}
          <section data-testid="dash-section-activity" className="dx-col">
            <h2 className="dx-section-h">{t('dash.activity')}</h2>
            <Card
              title={t('dash.card.consult30')}
              sub={t('dash.card.weeklyTrend')}
              right={
                <div className="dx-card-big">
                  <span className="dx-card-bignum">{clinical.data ? formatNumber(total30) : '—'}</span>
                  {trendPct != null && (
                    <span className={`dx-trend dx-${trendPct >= 0 ? 'pos' : 'neg'}`}>
                      {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct)}%
                    </span>
                  )}
                </div>
              }
            >
              {clinical.data ? <AreaTrend points={act} /> : <div className="dx-empty">{clinical.isLoading ? t('common.loading') : '—'}</div>}
            </Card>

            <Card title={t('dash.card.hourlyLoad')} sub={t('dash.card.hourlyLoadSub')}>
              {agenda.data ? <HourlyChart points={agenda.data.chargeHoraire} /> : <div className="dx-empty">{agenda.isLoading ? t('common.loading') : '—'}</div>}
            </Card>

            <Card title={t('dash.card.topPatho')} sub={t('dash.card.topPathoSub')}>
              {clinical.data ? (
                <RankedList
                  rows={topPathologies.slice(0, 5).map((p) => ({
                    label: p.label,
                    value: String(p.count),
                    pct: pathoTotal > 0 ? `${Math.round((p.count / pathoTotal) * 1000) / 10}%` : undefined,
                  }))}
                />
              ) : (
                <div className="dx-empty">{clinical.isLoading ? t('common.loading') : '—'}</div>
              )}
            </Card>
          </section>

          {/* RIGHT — Performance financière */}
          {showFinancial && (
            <section data-testid="dash-section-financial" className="dx-col">
              <h2 className="dx-section-h">{t('dash.financial')}</h2>
              <div className="dx-grid" style={{ ['--cols' as string]: 2 }}>
                <KpiCard
                  testId="kpi-ca-mois"
                  dot="green"
                  label={t('dash.kpi.caMonth')}
                  value={formatMoney(financial.data?.caMois)}
                  unit="MAD"
                  delta={caDeltaPct != null ? t('dash.kpi.caN1Delta', { sign: caDeltaPct >= 0 ? '+' : '', n: caDeltaPct }) : undefined}
                  deltaTone={caDeltaPct != null && caDeltaPct < 0 ? 'neg' : 'pos'}
                  loading={financial.isLoading && financial.isEnabled}
                />
                <KpiCard
                  testId="kpi-ca-ytd"
                  dot="indigo"
                  label={t('dash.kpi.caYtd')}
                  value={formatMoney(financial.data?.caYTD)}
                  unit="MAD"
                  loading={financial.isLoading && financial.isEnabled}
                />
                <KpiCard
                  testId="kpi-impayes"
                  dot="amber"
                  label={t('dash.kpi.unpaid')}
                  value={formatMoney(financial.data?.impayesTotal)}
                  unit="MAD"
                  delta={financial.data ? t('dash.kpi.unpaidDelta', { n: formatNumber(financial.data.impayesCount) }) : undefined}
                  deltaTone="warn"
                  loading={financial.isLoading && financial.isEnabled}
                />
                <KpiCard
                  testId="kpi-encaissement"
                  dot="green"
                  label={t('dash.kpi.collectRate')}
                  value={formatPct(financial.data?.tauxEncaissement)}
                  unit="%"
                  delta={t('dash.kpi.collectRateDelta')}
                  loading={financial.isLoading && financial.isEnabled}
                />
              </div>

              <Card title={t('dash.card.ca12')} sub={t('dash.card.ca12Sub')}>
                {financial.data ? <MonthlyChart points={financial.data.ca12Mois} /> : <div className="dx-empty">{financial.isLoading ? t('common.loading') : '—'}</div>}
              </Card>

              <Card title={t('dash.card.caByActe')} sub={t('dash.card.caByActeSub')}>
                {financial.data ? (
                  <RankedList
                    rows={caParActe.slice(0, 6).map((a) => ({
                      label: a.label || a.acteCode,
                      value: `${formatMoney(a.amount)} MAD`,
                      pct: `${a.count}×`,
                    }))}
                  />
                ) : (
                  <div className="dx-empty">{financial.isLoading ? t('common.loading') : '—'}</div>
                )}
              </Card>
            </section>
          )}
        </div>

        {/* ── AGENDA — semaine (bandeau secondaire) ────────────────────── */}
        <section data-testid="dash-section-agenda">
          <h2 className="dx-section-h">{t('dash.agendaWeek')}</h2>
          <div className="dx-grid" style={{ ['--cols' as string]: 4 }}>
            <KpiCard
              testId="kpi-rdv-semaine"
              dot="blue"
              label={t('dash.kpi.rdvWeek')}
              value={formatNumber(agenda.data?.rdvSemaine)}
              delta={agenda.data ? t('dash.kpi.fillRate', { n: formatPct(agenda.data.tauxRemplissageSemaine) }) : undefined}
              loading={agenda.isLoading && agenda.isEnabled}
            />
            <KpiCard
              testId="kpi-no-shows"
              dot="amber"
              label={t('dash.kpi.noShows')}
              value={formatNumber(agenda.data?.noShowsSemaine)}
              loading={agenda.isLoading && agenda.isEnabled}
            />
            <KpiCard
              testId="kpi-annulations"
              dot="amber"
              label={t('dash.kpi.cancellations')}
              value={formatNumber(agenda.data?.annulationsSemaine)}
              loading={agenda.isLoading && agenda.isEnabled}
            />
            <KpiCard
              testId="kpi-nouveaux-patients"
              dot="green"
              label={t('dash.kpi.newPatients')}
              value={formatNumber(agenda.data?.nouveauxPatientsMois)}
              loading={agenda.isLoading && agenda.isEnabled}
            />
          </div>
        </section>

        {(clinical.error || agenda.error || (showFinancial && financial.error)) && (
          <div data-testid="dash-errors" className="dash-error-banner">
            {clinical.error || agenda.error || financial.error}
          </div>
        )}
      </div>
    </Screen>
  );
}
