/**
 * V038 — page queue traitements internes (LAB ou RADIO).
 *
 * Polyvalente : utilisée pour les deux services via le param URL `service`.
 * 3 onglets :
 *   - En attente (PENDING)  : "Prendre en charge"
 *   - En cours   (IN_PROGRESS) : "Téléverser résultat" (V015)
 *   - Traitées   (DONE)     : historique consultable
 *
 * Mobile (< 768 px) : layout cards verticales pleine largeur.
 */
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useInternalRequests,
  useClaimInternalRequest,
  useCancelInternalRequest,
  type InternalService,
  type InternalStatus,
} from './hooks/useInternalRequests';
import { useAttachPrescriptionResult } from '@/features/prescription/hooks/usePrescriptionResult';

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

const TAB_MAP: Record<MobileTab, string> = {
  agenda: '/agenda',
  salle: '/salle',
  patients: '/patients',
  factu: '/facturation',
  menu: '/parametres',
};

const TABS: { id: InternalStatus; labelKey: string }[] = [
  { id: 'PENDING', labelKey: 'ir.tab.pending' },
  { id: 'IN_PROGRESS', labelKey: 'ir.tab.inProgress' },
  { id: 'DONE', labelKey: 'ir.tab.done' },
];

// Suffixe d'état affiché dans le sous-titre (lowercase) — clé par statut.
const STATUS_KEY: Record<InternalStatus, string> = {
  PENDING: 'ir.status.pending',
  IN_PROGRESS: 'ir.status.inProgress',
  DONE: 'ir.status.done',
  CANCELLED: 'ir.status.done',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function QueuePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { service: serviceParam } = useParams<{ service: string }>();
  const service: InternalService = serviceParam?.toUpperCase() === 'RADIO' ? 'RADIO' : 'LAB';
  const [tab, setTab] = useState<InternalStatus>('PENDING');
  const { rows, isLoading, error } = useInternalRequests(service, tab);
  const { claim, isPending: isClaiming } = useClaimInternalRequest();
  const { cancel, isPending: isCancelling } = useCancelInternalRequest();
  const { attach, isPending: isUploading } = useAttachPrescriptionResult();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingLineId, setUploadingLineId] = useState<string | null>(null);

  const title = service === 'LAB' ? t('ir.title.lab') : t('ir.title.radio');
  const ctaLabel = t('ir.claim');

  async function handleClaim(lineId: string) {
    try {
      await claim(lineId);
      toast.success(t('ir.toast.claimed'));
    } catch {
      toast.error(t('ir.toast.claimFailed'));
    }
  }

  async function handleCancel(lineId: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('ir.confirmCancel'))) return;
    try {
      await cancel(lineId);
      toast.success(t('ir.toast.cancelled'));
    } catch {
      toast.error(t('ir.toast.cancelFailed'));
    }
  }

  function pickResult(lineId: string) {
    setUploadingLineId(lineId);
    fileRef.current?.click();
  }

  async function handleResultFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadingLineId) return;
    try {
      await attach({ lineId: uploadingLineId, file });
      toast.success(t('ir.toast.resultUploaded'));
    } catch {
      toast.error(t('ir.toast.uploadFailed'));
    } finally {
      setUploadingLineId(null);
    }
  }

  // Visualiser un résultat (tab DONE) : fetch en blob via axios pour passer le
  // Bearer JWT in-memory (cf. ADR-019). Ouverture window.open d'un blob URL.
  // Avant ce fix : on tentait un `window.open('/api/documents/{id}/content')`
  // direct → le browser n'envoyait pas le JWT (cookie HttpOnly seulement),
  // d'où le 401 UNAUTHORIZED côté user.
  async function viewResult(documentId: string) {
    try {
      const res = await api.get(`/documents/${documentId}/content`, {
        responseType: 'arraybuffer',
      });
      const ctype = (res.headers['content-type'] as string) ?? 'application/octet-stream';
      const blob = new Blob([res.data as ArrayBuffer], { type: ctype });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Libère la mémoire un peu plus tard (le browser doit avoir le temps d'ouvrir).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t('ir.toast.openFailed'));
    }
  }

  const tabBar = (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: isMobile ? '10px 12px' : '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        overflowX: 'auto',
      }}
      role="tablist"
      aria-label={t('ir.tabsAria')}
    >
      {TABS.map((tabItem) => (
        <button
          key={tabItem.id}
          type="button"
          role="tab"
          aria-selected={tab === tabItem.id}
          onClick={() => setTab(tabItem.id)}
          style={{
            padding: '6px 14px',
            border: '1px solid var(--border)',
            borderRadius: 999,
            background: tab === tabItem.id ? 'var(--primary)' : 'var(--surface)',
            color: tab === tabItem.id ? 'white' : 'var(--ink-2)',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 550,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t(tabItem.labelKey)}
        </button>
      ))}
    </div>
  );

  const list = (
    <div style={{ padding: isMobile ? 12 : 24, overflow: 'auto', flex: 1 }} className="scroll">
      {isLoading && (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('ir.loading')}</div>
      )}
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{t('ir.err.load')}</div>
      )}
      {!isLoading && !error && rows.length === 0 && (
        <Panel>
          <PanelHeader>{t('ir.empty.title')}</PanelHeader>
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
            {t('ir.empty.body', { status: t(STATUS_KEY[tab]) })}
          </div>
        </Panel>
      )}

      {rows.map((row) => (
        <div
          key={row.lineId}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface)',
            padding: 14,
            marginBottom: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 14 }}>{row.testName ?? '—'}</strong>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t('ir.patient', { name: row.patientName ?? '—' })}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t('ir.requestedBy', { name: row.doctorName ?? '—' })}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
              {formatDateTime(row.assignedAt)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {tab === 'PENDING' && (
              <>
                <Button variant="ghost" size="sm" disabled={isCancelling} onClick={() => void handleCancel(row.lineId)}>
                  {t('ir.cancel')}
                </Button>
                <Button variant="primary" size="sm" disabled={isClaiming} onClick={() => void handleClaim(row.lineId)}>
                  {ctaLabel}
                </Button>
              </>
            )}
            {tab === 'IN_PROGRESS' && (
              <>
                <Button variant="ghost" size="sm" disabled={isCancelling} onClick={() => void handleCancel(row.lineId)}>
                  {t('ir.cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => pickResult(row.lineId)}
                >
                  {isUploading && uploadingLineId === row.lineId ? t('ir.uploading') : t('ir.uploadResult')}
                </Button>
              </>
            )}
            {tab === 'DONE' && (
              <>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 'auto' }}>
                  {t('ir.resultAttached')}
                </span>
                {row.resultDocumentId && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void viewResult(row.resultDocumentId!)}
                  >
                    {t('ir.viewResult')}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          void handleResultFile(e);
        }}
        style={{ display: 'none' }}
        data-testid="result-file-input"
      />
    </div>
  );

  if (isMobile) {
    return (
      <MScreen
        tab="menu"
        onTabChange={(t) => navigate(TAB_MAP[t])}
        topbar={
          <MTopbar
            left={<MIconBtn icon="ChevronLeft" label={t('ir.back')} onClick={() => navigate('/parametres')} />}
            title={title}
            sub={t('ir.sub', { n: rows.length, s: rows.length > 1 ? 's' : '', status: t(STATUS_KEY[tab]) })}
          />
        }
      >
        {tabBar}
        {list}
      </MScreen>
    );
  }

  return (
    <Screen
      // V038 — pas de slot dédié dans la sidebar pour la queue, on n'active rien.
      active="dashboard"
      title={title}
      sub={t('ir.sub', { n: rows.length, s: rows.length > 1 ? 's' : '', status: t(STATUS_KEY[tab]) })}
      onNavigate={(id) => navigate(NAV_MAP[id])}
    >
      {tabBar}
      {list}
    </Screen>
  );
}
