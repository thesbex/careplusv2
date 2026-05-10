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

const TABS: { id: InternalStatus; label: string }[] = [
  { id: 'PENDING', label: 'En attente' },
  { id: 'IN_PROGRESS', label: 'En cours' },
  { id: 'DONE', label: 'Traitées' },
];

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

  const title = service === 'LAB' ? 'Laboratoire' : 'Radiologie';
  const ctaLabel = service === 'LAB' ? 'Prendre en charge' : 'Prendre en charge';

  async function handleClaim(lineId: string) {
    try {
      await claim(lineId);
      toast.success('Demande prise en charge.');
    } catch {
      toast.error('Échec de la prise en charge.');
    }
  }

  async function handleCancel(lineId: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Annuler cette demande ?')) return;
    try {
      await cancel(lineId);
      toast.success('Demande annulée.');
    } catch {
      toast.error("Annulation impossible.");
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
      toast.success('Résultat téléversé.');
    } catch {
      toast.error('Échec du téléversement du résultat.');
    } finally {
      setUploadingLineId(null);
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
      aria-label="Onglets queue"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => setTab(t.id)}
          style={{
            padding: '6px 14px',
            border: '1px solid var(--border)',
            borderRadius: 999,
            background: tab === t.id ? 'var(--primary)' : 'var(--surface)',
            color: tab === t.id ? 'white' : 'var(--ink-2)',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 550,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  const list = (
    <div style={{ padding: isMobile ? 12 : 24, overflow: 'auto', flex: 1 }} className="scroll">
      {isLoading && (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
      )}
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      )}
      {!isLoading && !error && rows.length === 0 && (
        <Panel>
          <PanelHeader>Rien à afficher</PanelHeader>
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
            Aucune demande {tab === 'PENDING' ? 'en attente' : tab === 'IN_PROGRESS' ? 'en cours' : 'traitée'}.
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
              Patient : {row.patientName ?? '—'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Demandé par : {row.doctorName ?? '—'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
              {formatDateTime(row.assignedAt)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {tab === 'PENDING' && (
              <>
                <Button variant="ghost" size="sm" disabled={isCancelling} onClick={() => void handleCancel(row.lineId)}>
                  Annuler
                </Button>
                <Button variant="primary" size="sm" disabled={isClaiming} onClick={() => void handleClaim(row.lineId)}>
                  {ctaLabel}
                </Button>
              </>
            )}
            {tab === 'IN_PROGRESS' && (
              <>
                <Button variant="ghost" size="sm" disabled={isCancelling} onClick={() => void handleCancel(row.lineId)}>
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => pickResult(row.lineId)}
                >
                  {isUploading && uploadingLineId === row.lineId ? 'Téléversement…' : 'Téléverser résultat'}
                </Button>
              </>
            )}
            {tab === 'DONE' && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                Résultat attaché à la consultation
              </span>
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
            left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/parametres')} />}
            title={title}
            sub={`${rows.length} demande${rows.length > 1 ? 's' : ''} ${tab.toLowerCase()}`}
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
      sub={`${rows.length} demande${rows.length > 1 ? 's' : ''} ${tab.toLowerCase()}`}
      onNavigate={(id) => navigate(NAV_MAP[id])}
    >
      {tabBar}
      {list}
    </Screen>
  );
}
