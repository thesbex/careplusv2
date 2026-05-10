/**
 * Index page for /consultations (no id).
 * Lists the current practitioner's consultations grouped by status.
 */
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { ChevronRight, Lock } from '@/components/icons';
import { useIsMobile } from '@/lib/responsive/useMediaQuery';
import { useConsultations } from './hooks/useConsultations';
import type { ConsultationApi } from './hooks/useConsultation';

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

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function Row({
  c,
  onOpen,
}: {
  c: ConsultationApi;
  onOpen: (id: string) => void;
}) {
  const isSigned = c.status === 'SIGNEE';
  return (
    <button
      type="button"
      onClick={() => onOpen(c.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          Consultation #{shortId(c.id)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
          Patient {shortId(c.patientId)} · {fmtDateTime(c.startedAt)}
          {c.signedAt ? ` · signée ${fmtDateTime(c.signedAt)}` : ''}
        </div>
        {c.motif && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-2)',
              marginTop: 4,
              maxWidth: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {c.motif}
          </div>
        )}
      </div>
      <Pill status={isSigned ? 'done' : 'consult'} dot>
        {isSigned ? 'Signée' : 'Brouillon'}
      </Pill>
      {isSigned && <Lock aria-hidden="true" />}
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

export default function ConsultationsListPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { consultations, isLoading, error } = useConsultations();

  const drafts = consultations.filter((c) => c.status === 'BROUILLON');
  const signed = consultations.filter((c) => c.status === 'SIGNEE');

  const body = (
    <>
      {isLoading && (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
      )}
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

      {!isLoading && consultations.length === 0 && !error && (
        <Panel>
          <div
            style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            Aucune consultation pour le moment. Démarrez-en une depuis la salle d'attente
            ou la fiche patient.
          </div>
        </Panel>
      )}

      {drafts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Panel>
            <PanelHeader>
              <span>En cours · brouillon ({drafts.length})</span>
            </PanelHeader>
            <div style={{ padding: 12 }}>
              {drafts.map((c) => (
                <Row key={c.id} c={c} onOpen={(id) => navigate(`/consultations/${id}`)} />
              ))}
            </div>
          </Panel>
        </div>
      )}

      {signed.length > 0 && (
        <Panel>
          <PanelHeader>
            <span>Signées ({signed.length})</span>
          </PanelHeader>
          <div style={{ padding: 12 }}>
            {signed.map((c) => (
              <Row key={c.id} c={c} onOpen={(id) => navigate(`/consultations/${id}`)} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );

  if (isMobile) {
    return (
      <MScreen
        tab="menu"
        onTabChange={(t) => navigate(TAB_MAP[t])}
        topbar={
          <MTopbar
            left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/parametres')} />}
            title="Mes consultations"
            sub={`${consultations.length} consultation${consultations.length > 1 ? 's' : ''}`}
          />
        }
        fab={
          <button
            type="button"
            onClick={() => navigate('/patients')}
            aria-label="Démarrer depuis un patient"
            style={{
              position: 'fixed',
              right: 16,
              bottom: 76,
              padding: '10px 16px',
              borderRadius: 999,
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              zIndex: 5,
            }}
          >
            + Depuis patient
          </button>
        }
      >
        <div style={{ padding: 12 }}>{body}</div>
      </MScreen>
    );
  }

  return (
    <Screen
      active="consult"
      title="Mes consultations"
      sub={`${consultations.length} consultation${consultations.length > 1 ? 's' : ''}`}
      topbarRight={
        <Button onClick={() => navigate('/patients')}>
          Démarrer depuis un patient →
        </Button>
      }
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <div style={{ padding: 24, overflow: 'auto' }} className="scroll">
        {body}
      </div>
    </Screen>
  );
}
