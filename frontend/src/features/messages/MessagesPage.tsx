/**
 * Screen 14 — Messages équipe (desktop) — ADR-035 v2.
 *
 * Iso-maquette `design/prototype/screens/messages.jsx`. Données pilotées par
 * l'API `/api/chat/**` (V048) — plus de fixtures, tout sort du backend :
 *   - canaux, DMs, fils patient → hooks `useChannels` / `useDirectMessages` / `usePatientThreads`
 *   - conversation active → `useConversation(id)`
 *   - team rail droit → `useTeam`
 *   - envoi de message → `useSendMessage`
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Screen } from '@/components/shell/Screen';
import {
  Search,
  Plus,
  Filter,
  Pin,
  MoreH,
  Send,
  At,
  Smile,
  Stetho,
} from '@/components/icons';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useChannels } from './hooks/useChannels';
import { useDirectMessages } from './hooks/useDirectMessages';
import { usePatientThreads } from './hooks/usePatientThreads';
import { useTeam } from './hooks/useTeam';
import { useConversation } from './hooks/useConversation';
import { useSendMessage } from './hooks/useSendMessage';
import { useColleagues } from './hooks/useColleagues';
import { useStartDm } from './hooks/useStartDm';
import type {
  ChatMessage,
  Channel,
  Conversation,
  DirectMessage,
  PatientThread,
  TeamMember,
} from './types';
import './messages.css';

export default function MessagesPage() {
  const { data: channels = [] } = useChannels();
  const { data: dms = [] } = useDirectMessages();
  const { data: patientThreads = [] } = usePatientThreads();
  const { data: team = [] } = useTeam();

  // Première conv disponible — préfère "urgences" si présent, sinon premier canal,
  // sinon premier DM. Reste null tant que les listes ne sont pas chargées.
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  useEffect(() => {
    if (activeConvo) return;
    const urgences = channels.find((c) => c.name === 'urgences');
    const first =
      urgences?.id ?? channels[0]?.id ?? dms[0]?.id ?? patientThreads[0]?.id ?? null;
    if (first) setActiveConvo(first);
  }, [activeConvo, channels, dms, patientThreads]);

  const { data: convo } = useConversation(activeConvo);
  const [composer, setComposer] = useState('');
  const sendMessage = useSendMessage();
  // DM picker — ouvert au clic sur le + de la section "Messages directs"
  // (RailHeader) ou sur "Nouveau message" du topbar.
  const [dmPickerOpen, setDmPickerOpen] = useState(false);
  const colleaguesQuery = useColleagues(dmPickerOpen);
  const startDm = useStartDm();

  function handleSend() {
    if (!activeConvo || !composer.trim()) return;
    sendMessage.mutate({ conversationId: activeConvo, body: composer.trim() });
    setComposer('');
  }

  function handlePickColleague(userId: string) {
    setDmPickerOpen(false);
    startDm.mutate(userId, {
      onSuccess: (conv) => setActiveConvo(conv.id),
    });
  }

  const onlineCount = team.filter((m) => m.online === 'on' || m.online === 'self').length;
  const subline =
    team.length > 0 ? `${team.length} membre${team.length > 1 ? 's' : ''} · ${onlineCount} en ligne` : '';

  return (
    <Screen
      active="messages"
      title="Messages équipe"
      sub={subline}
      topbarRight={
        <>
          <Button>
            <Filter /> Tous
          </Button>
          <Button variant="primary" onClick={() => setDmPickerOpen(true)}>
            <Plus /> Nouveau message
          </Button>
        </>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 280px',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <LeftRail
          channels={channels}
          dms={dms}
          patientThreads={patientThreads}
          active={activeConvo ?? ''}
          onSelect={setActiveConvo}
          self={team.find((m) => m.online === 'self')}
          onAddDm={() => setDmPickerOpen(true)}
        />
        {dmPickerOpen && (
          <ColleaguePicker
            colleagues={colleaguesQuery.data ?? []}
            loading={colleaguesQuery.isLoading}
            onPick={handlePickColleague}
            onClose={() => setDmPickerOpen(false)}
          />
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          {convo ? (
            <>
              <ConvoHeader convo={convo} />
              <ConvoMessages convo={convo} />
              <ConvoComposer
                value={composer}
                onChange={setComposer}
                onSend={handleSend}
                sending={sendMessage.isPending}
                members={convo.members ?? team}
              />
            </>
          ) : (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
              Chargement…
            </div>
          )}
        </div>

        <RightRail convo={convo} team={team} />
      </div>
    </Screen>
  );
}

// ════════════════════════════════════════════════════════════
// Left rail
// ════════════════════════════════════════════════════════════
interface LeftRailProps {
  channels: Channel[];
  dms: DirectMessage[];
  patientThreads: PatientThread[];
  active: string;
  onSelect: (id: string) => void;
  self: TeamMember | undefined;
  onAddDm: () => void;
}

function LeftRail({ channels, dms, patientThreads, active, onSelect, self, onAddDm }: LeftRailProps) {
  return (
    <div
      style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--surface-2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
        <div
          style={{
            height: 32,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            gap: 8,
            color: 'var(--ink-3)',
            fontSize: 12.5,
          }}
        >
          <Search />
          <span>Rechercher une conversation</span>
        </div>
      </div>

      <div className="scroll" style={{ overflow: 'auto', flex: 1, padding: '4px 8px 12px' }}>
        <RailHeader label="Canaux" count={channels.length} />
        {channels.map((c) => (
          <ChannelRow key={c.id} c={c} active={active === c.id} onClick={() => onSelect(c.id)} />
        ))}

        <RailHeader label="Messages directs" count={dms.length} mt={14} onAdd={onAddDm} />
        {dms.map((d) => (
          <DMRow key={d.id} d={d} active={active === d.id} onClick={() => onSelect(d.id)} />
        ))}

        <RailHeader label="Fils patient" count={patientThreads.length} mt={14} hint />
        {patientThreads.map((p) => (
          <PatientThreadRow key={p.id} p={p} active={active === p.id} onClick={() => onSelect(p.id)} />
        ))}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-alt)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ position: 'relative' }}>
          <Avatar initials={self?.initials ?? '?'} size="md" />
          <span
            style={{
              position: 'absolute',
              bottom: -1,
              right: -1,
              width: 9,
              height: 9,
              borderRadius: 5,
              background: 'var(--success)',
              border: '2px solid var(--bg-alt)',
            }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1, fontSize: 11.5 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{self?.name ?? '—'}</div>
          <div style={{ color: 'var(--success)', fontSize: 10.5, fontWeight: 600 }}>● En ligne</div>
        </div>
        <button
          type="button"
          aria-label="Plus d'actions"
          style={{
            height: 26,
            width: 26,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-3)',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 4,
          }}
        >
          <MoreH />
        </button>
      </div>
    </div>
  );
}

function RailHeader({
  label,
  count,
  mt,
  hint,
  onAdd,
}: {
  label: string;
  count: number;
  mt?: number;
  hint?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div
      style={{
        marginTop: mt ?? 4,
        padding: '6px 6px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span className="tnum" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
        {count}
      </span>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        aria-label={`Ajouter dans ${label}`}
        onClick={onAdd}
        disabled={!onAdd}
        style={{
          background: 'transparent',
          border: 0,
          color: onAdd ? 'var(--ink-3)' : 'var(--ink-4)',
          cursor: onAdd ? 'pointer' : 'default',
          padding: '2px 4px',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Plus />
      </button>
      {hint && (
        <span
          title="Conversations rattachées à un dossier patient"
          style={{
            fontSize: 9,
            color: 'var(--primary)',
            background: 'var(--primary-soft)',
            padding: '1px 5px',
            borderRadius: 3,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          NEW
        </span>
      )}
    </div>
  );
}

function ChannelRow({ c, active, onClick }: { c: Channel; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '5px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'white' : c.unread > 0 ? 'var(--ink)' : 'var(--ink-2)',
        border: 0,
        font: 'inherit',
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          opacity: active ? 1 : 0.6,
        }}
      >
        #
      </span>
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: c.unread > 0 ? 700 : 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {c.name}
      </span>
      {c.mentions > 0 && (
        <span
          className="tnum"
          style={{
            background: active ? 'rgba(255,255,255,0.2)' : 'var(--danger)',
            color: 'white',
            fontSize: 9.5,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 8,
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          @{c.mentions}
        </span>
      )}
      {c.unread > 0 && !c.mentions && (
        <span
          className="tnum"
          style={{
            background: active ? 'rgba(255,255,255,0.25)' : 'var(--ink)',
            color: 'white',
            fontSize: 9.5,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 8,
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {c.unread}
        </span>
      )}
    </button>
  );
}

function DMRow({ d, active, onClick }: { d: DirectMessage; active: boolean; onClick: () => void }) {
  const dot =
    ({ on: 'var(--success)', away: 'var(--amber)', off: 'var(--ink-4)' } as const)[
      d.contact.online === 'self' ? 'on' : d.contact.online
    ] ?? 'var(--ink-4)';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'white' : 'var(--ink-2)',
        border: 0,
        font: 'inherit',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          className="cp-avatar"
          style={{ width: 22, height: 22, fontSize: 9, background: d.contact.color }}
        >
          {d.contact.initials}
        </div>
        <span
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 7,
            height: 7,
            borderRadius: 4,
            background: dot,
            border: '1.5px solid ' + (active ? 'var(--primary)' : 'var(--surface-2)'),
          }}
        />
      </div>
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: d.unread > 0 ? 700 : 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {d.contact.name}
      </span>
      {d.unread > 0 && (
        <span
          className="tnum"
          style={{
            background: active ? 'rgba(255,255,255,0.25)' : 'var(--ink)',
            color: 'white',
            fontSize: 9.5,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 8,
            minWidth: 16,
            textAlign: 'center',
          }}
        >
          {d.unread}
        </span>
      )}
    </button>
  );
}

function PatientThreadRow({
  p,
  active,
  onClick,
}: {
  p: PatientThread;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '7px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? 'white' : 'inherit',
        border: 0,
        font: 'inherit',
      }}
    >
      <span
        style={{
          marginTop: 5,
          width: 5,
          height: 5,
          borderRadius: 3,
          flexShrink: 0,
          background: p.open ? (active ? 'rgba(255,255,255,0.8)' : p.color) : 'var(--ink-4)',
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: active ? 'white' : 'var(--ink-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {p.patient}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: active ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}
        >
          {p.subj}
        </div>
      </div>
      <span
        className="tnum"
        style={{
          fontSize: 9.5,
          color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)',
          fontWeight: 600,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {p.time}
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// Header / messages / composer (center column)
// ════════════════════════════════════════════════════════════
function ConvoHeader({ convo }: { convo: Conversation }) {
  const members = convo.members ?? [];
  // Badge URGENT n'apparaît que sur le canal "urgences" (sémantique : canal dédié)
  const showUrgent = convo.kind === 'channel' && convo.name === 'urgences';
  const prefix = convo.kind === 'channel' ? '#' : convo.kind === 'patient' ? '◆' : '@';
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
            }}
          >
            {prefix}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {convo.name}
          </span>
          {showUrgent && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                borderRadius: 10,
                fontSize: 10.5,
                fontWeight: 700,
                marginLeft: 4,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 3, background: 'var(--danger)' }} />
              URGENT
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, maxWidth: 460 }}>
          {convo.topic}
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {members.slice(0, 4).map((m, i) => (
            <div
              key={m.id}
              className="cp-avatar"
              style={{
                width: 26,
                height: 26,
                fontSize: 9.5,
                background: m.color,
                marginLeft: i === 0 ? 0 : -8,
                border: '2px solid var(--surface)',
              }}
            >
              {m.initials}
            </div>
          ))}
          {members.length > 4 && (
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                marginLeft: -8,
                background: 'var(--bg-alt)',
                color: 'var(--ink-2)',
                border: '2px solid var(--surface)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 9.5,
                fontWeight: 700,
              }}
            >
              +{members.length - 4}
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm">
          <Pin /> {convo.pinned ?? 1}
        </Button>
        <Button variant="ghost" size="sm" aria-label="Plus d'actions">
          <MoreH />
        </Button>
      </div>
    </div>
  );
}

function ConvoMessages({ convo }: { convo: Conversation }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Comptage total des messages pour déclencher l'auto-scroll quand un nouveau
  // arrive (polling 5 s côté useConversation).
  const totalMsgs = (convo.messages ?? []).reduce((n, d) => n + d.msgs.length, 0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Auto-scroll vers le bas si l'user était déjà proche du bas (évite de
    // l'arracher d'un scroll-back qu'il fait pour lire l'historique).
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMsgs, convo.id]);

  return (
    <div
      ref={scrollRef}
      className="scroll"
      style={{ flex: 1, overflow: 'auto', padding: '0 0 12px' }}
    >
      {convo.pinned ? (
        <div
          style={{
            margin: '12px 24px 8px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--amber-soft)',
            border: '1px solid var(--amber)',
            borderRadius: 6,
            fontSize: 11.5,
          }}
        >
          <span style={{ color: 'var(--amber)' }}>
            <Pin />
          </span>
          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Épinglé :</span>
          <span
            style={{
              color: 'var(--ink-2)',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {convo.pinnedBody ?? '—'}
          </span>
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: 'var(--amber)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Voir
          </button>
        </div>
      ) : null}

      {(convo.messages ?? []).map((day, di) => (
        <div key={di}>
          <DayDivider label={day.day} />
          {day.msgs.map((m, mi) => {
            const previous = mi > 0 ? day.msgs[mi - 1] : undefined;
            const previousFromSameUser = !!previous && previous.u.id === m.u.id && !previous.patient;
            return <Message key={mi} m={m} previousFromSameUser={previousFromSameUser} />;
          })}
        </div>
      ))}

      {convo.typing ? (
        <div
          style={{
            padding: '6px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--ink-3)',
            fontSize: 11.5,
          }}
        >
          <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
            {[0, 0.2, 0.4].map((d) => (
              <span
                key={d}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--ink-3)',
                  animation: 'chatdot 1.2s infinite',
                  animationDelay: `${d}s`,
                }}
              />
            ))}
          </span>
          <span>
            <strong style={{ color: 'var(--ink-2)' }}>{convo.typing}</strong> est en train d&apos;écrire…
          </span>
        </div>
      ) : null}
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 24px 6px',
        position: 'sticky',
        top: 0,
        background: 'linear-gradient(to bottom, var(--surface) 70%, transparent)',
        zIndex: 5,
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          padding: '2px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function Message({
  m,
  previousFromSameUser,
}: {
  m: ChatMessage;
  previousFromSameUser: boolean;
}) {
  const isUrgent = !!m.urgent;
  return (
    <div
      style={{
        // Fix alignement : on garde TOUJOURS le même padding gauche (24px) + le
        // spacer 34px + gap 12 = 70px total. Avant, les messages groupés
        // avaient un padding-left 70px ET un spacer 34px → 116px (texte
        // décalé loin à droite).
        padding: previousFromSameUser ? '2px 24px 2px 24px' : '8px 24px 4px',
        display: 'flex',
        gap: 12,
        background: isUrgent ? 'var(--danger-soft)' : 'transparent',
        borderLeft: isUrgent ? '3px solid var(--danger)' : '3px solid transparent',
      }}
    >
      {previousFromSameUser ? (
        <div style={{ width: 34, flexShrink: 0 }} />
      ) : (
        <div
          className="cp-avatar"
          style={{ width: 34, height: 34, fontSize: 11.5, background: m.u.color, flexShrink: 0 }}
        >
          {m.u.initials}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!previousFromSameUser && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{m.u.name}</span>
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--bg-alt)',
                color: 'var(--ink-3)',
                fontWeight: 600,
              }}
            >
              {m.u.role}
            </span>
            <span className="tnum" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
              {m.time}
            </span>
          </div>
        )}
        <MessageBody text={m.text} />
        {m.patient && <PatientAttachCard p={m.patient} />}
        {m.reactions && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {m.reactions.map((r, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 7px',
                  borderRadius: 11,
                  background: 'var(--primary-soft)',
                  border: '1px solid var(--primary)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  cursor: 'pointer',
                }}
              >
                <span>{r.emoji}</span>
                <span className="tnum">{r.count}</span>
              </span>
            ))}
            <button
              type="button"
              aria-label="Ajouter une réaction"
              style={{
                padding: '2px 7px',
                borderRadius: 11,
                background: 'var(--surface)',
                border: '1px dashed var(--border-strong)',
                fontSize: 11,
                color: 'var(--ink-3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Smile />
            </button>
          </div>
        )}
        {m.reply && (
          <div
            style={{
              marginTop: 6,
              padding: '4px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{m.reply.count} réponses</span>
            <span style={{ color: 'var(--ink-3)' }}>· dernière {m.reply.last}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBody({ text }: { text: string }) {
  const parts = text.split(/(@[A-Za-zÀ-ÿ.\s]+(?=\s|,|$))/g);
  return (
    <div
      style={{
        fontSize: 13,
        color: 'var(--ink)',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.5,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
    >
      {parts.map((p, i) => {
        if (p.startsWith('@')) {
          return (
            <span
              key={i}
              style={{
                background: 'var(--primary-soft)',
                color: 'var(--primary)',
                padding: '0 4px',
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              {p.trim()}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </div>
  );
}

function PatientAttachCard({ p }: { p: { name: string; id: string; age: number } }) {
  const initials = p.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      style={{
        marginTop: 6,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--surface)',
        border: '1px solid var(--primary)',
        borderLeft: '4px solid var(--primary)',
        borderRadius: 4,
        maxWidth: 380,
      }}
    >
      <div className="cp-avatar" style={{ width: 30, height: 30, fontSize: 10, background: '#1E5AA8' }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{p.name}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
          {p.id} · {p.age} ans
        </div>
      </div>
      <Button variant="primary" size="sm">
        Ouvrir dossier
      </Button>
    </div>
  );
}

// Common emojis sans dépendance externe — assez pour un cabinet médical
// (cf. CLAUDE.md règle 9 : pas de lib sans ADR).
const COMPOSER_EMOJIS = [
  '👍', '👎', '🙏', '👌', '✅', '❌', '⚠️', '🚨',
  '💊', '🩺', '🩸', '🌡️', '💉', '🏥', '🚑', '🦷',
  '👋', '🤝', '👀', '🧠', '❤️', '🔥', '⏰', '📅',
  '💡', '📝', '📞', '🤔', '😊', '🙌', '👶', '👵',
];

function ConvoComposer({
  value,
  onChange,
  onSend,
  sending,
  members,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  members: TeamMember[];
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);

  // Insertion à la position du curseur, avec une espace en suffixe pour rester
  // dans le flux de frappe. Restaure le focus + la sélection juste après.
  function insertAtCursor(insert: string) {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + insert);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '12px 24px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'relative',
      }}
    >
      {emojiOpen && (
        <EmojiPickerPopover
          onPick={(e) => {
            insertAtCursor(e);
            setEmojiOpen(false);
          }}
          onClose={() => setEmojiOpen(false)}
        />
      )}
      {mentionOpen && (
        <MentionPickerPopover
          members={members}
          onPick={(m) => {
            const firstName = m.name.split(' ')[0];
            const prefix = value && !/[\s\n]$/.test(value) ? ' ' : '';
            insertAtCursor(`${prefix}@${firstName} `);
            setMentionOpen(false);
          }}
          onClose={() => setMentionOpen(false)}
        />
      )}
      <div
        style={{
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          background: 'var(--surface)',
          boxShadow: '0 0 0 3px rgba(42, 124, 231, 0.08)',
        }}
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Saisir un message — Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne"
          style={{
            width: '100%',
            border: 0,
            outline: 0,
            resize: 'none',
            padding: '10px 12px',
            fontSize: 13,
            fontFamily: 'inherit',
            color: 'var(--ink)',
            background: 'transparent',
            boxSizing: 'border-box',
            minHeight: 56,
            maxHeight: 120,
          }}
        />

        <div
          style={{
            padding: '6px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderTop: '1px solid var(--border-soft)',
          }}
        >
          <ComposerBtn
            icon={<At />}
            ariaLabel="Mentionner un collègue"
            active={mentionOpen}
            onClick={() => {
              setEmojiOpen(false);
              setMentionOpen((v) => !v);
            }}
          />
          <ComposerBtn
            icon={<Smile />}
            ariaLabel="Ajouter une émoticône"
            active={emojiOpen}
            onClick={() => {
              setMentionOpen(false);
              setEmojiOpen((v) => !v);
            }}
          />
          {/* Patient : picker à câbler quand le module sera prêt — laissé désactivé
              pour ne pas re-créer un bouton fantôme. */}
          <ComposerBtn icon={<Stetho />} label="Patient" disabled />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10.5, color: 'var(--ink-4)', marginRight: 8 }}>
            <span
              className="mono"
              style={{
                padding: '1px 5px',
                border: '1px solid var(--border)',
                borderRadius: 3,
                fontSize: 10,
                color: 'var(--ink-3)',
              }}
            >
              ⏎
            </span>
            <span style={{ marginLeft: 4 }}>pour envoyer</span>
          </span>
          <Button
            variant="primary"
            size="sm"
            style={{ height: 28, padding: '0 12px', gap: 6 }}
            onClick={onSend}
            disabled={sending || !value.trim()}
          >
            <Send /> {sending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ComposerBtn({
  icon,
  label,
  ariaLabel,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label?: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    height: 26,
    padding: label ? '0 8px' : '0 6px',
    border: 0,
    borderRadius: 4,
    background: active ? 'var(--primary-soft)' : 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: active ? 'var(--primary)' : disabled ? 'var(--ink-4)' : 'var(--ink-3)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11.5,
    fontWeight: 500,
    opacity: disabled ? 0.6 : 1,
  };
  return (
    <button
      type="button"
      style={style}
      aria-label={ariaLabel}
      aria-pressed={active ? true : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function EmojiPickerPopover({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        role="button"
        aria-label="Fermer le sélecteur d'émoticônes"
        tabIndex={-1}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
      />
      <div
        role="dialog"
        aria-label="Émoticônes"
        style={{
          position: 'absolute',
          bottom: 72,
          left: 24,
          width: 256,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          zIndex: 100,
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 2,
        }}
      >
        {COMPOSER_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            aria-label={`Émoticône ${e}`}
            style={{
              width: 28,
              height: 28,
              border: 0,
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}

function MentionPickerPopover({
  members,
  onPick,
  onClose,
}: {
  members: TeamMember[];
  onPick: (m: TeamMember) => void;
  onClose: () => void;
}) {
  // Exclut le user courant (self) ; le @moi n'a aucun sens dans un message.
  const list = members.filter((m) => m.online !== 'self');
  return (
    <>
      <div
        role="button"
        aria-label="Fermer le sélecteur de mention"
        tabIndex={-1}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
      />
      <div
        role="dialog"
        aria-label="Mentionner un collègue"
        style={{
          position: 'absolute',
          bottom: 72,
          left: 24,
          width: 260,
          maxHeight: 260,
          overflow: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 4,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          zIndex: 100,
        }}
      >
        {list.length === 0 && (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--ink-3)' }}>
            Aucun collègue à mentionner.
          </div>
        )}
        {list.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12.5,
              color: 'var(--ink)',
              textAlign: 'left',
              borderRadius: 4,
            }}
          >
            <div
              className="cp-avatar"
              style={{ width: 22, height: 22, fontSize: 9, background: m.color }}
            >
              {m.initials}
            </div>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.name}
            </span>
            <span style={{ color: 'var(--ink-4)', fontSize: 10.5 }}>{m.role}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// Right rail
// ════════════════════════════════════════════════════════════
function RightRail({ convo, team }: { convo: Conversation | undefined; team: TeamMember[] }) {
  const members = convo?.members ?? team;
  // Patients référencés dans les messages de la conversation — dédupliqués.
  const linkedPatients = (() => {
    if (!convo?.messages) return [];
    const seen = new Map<string, { id: string; name: string; tag: string; tagColor: string }>();
    for (const day of convo.messages) {
      for (const m of day.msgs) {
        if (m.patient && !seen.has(m.patient.id)) {
          seen.set(m.patient.id, {
            id: m.patient.id,
            name: m.patient.name,
            tag: 'Patient',
            tagColor: 'var(--primary)',
          });
        }
      }
    }
    return [...seen.values()];
  })();

  if (!convo) {
    return (
      <div
        style={{
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface-2)',
          overflow: 'auto',
          padding: 14,
          color: 'var(--ink-3)',
          fontSize: 12,
        }}
      >
        Sélectionnez une conversation.
      </div>
    );
  }
  return (
    <div
      className="scroll"
      style={{
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)',
        overflow: 'auto',
        padding: '14px 14px 24px',
      }}
    >
      <SectionLabel>À propos</SectionLabel>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 12 }}>
        {convo.topic || 'Pas de description.'}
      </div>

      <SectionLabel>Membres · {members.length}</SectionLabel>
      <div style={{ marginBottom: 14 }}>
        {members.map((m) => (
          <MemberRow key={m.id} m={m} />
        ))}
        <button
          type="button"
          style={{
            width: '100%',
            justifyContent: 'flex-start',
            background: 'transparent',
            border: 0,
            padding: '6px 4px',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          <Plus /> Inviter un membre
        </button>
      </div>

      <SectionLabel>Fichiers partagés · 0</SectionLabel>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--ink-3)',
          background: 'var(--surface)',
          border: '1px dashed var(--border)',
          borderRadius: 4,
          padding: '8px 10px',
          marginBottom: 14,
          lineHeight: 1.4,
        }}
      >
        Le partage de fichiers arrivera dans une prochaine itération
        (module Documents existant à brancher).
      </div>

      {linkedPatients.length > 0 && (
        <>
          <SectionLabel>Patients liés · {linkedPatients.length}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linkedPatients.map((p) => (
              <LinkedPatient
                key={p.id}
                name={p.name}
                id={p.id}
                tag={p.tag}
                tagColor={p.tagColor}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--ink-3)',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function MemberRow({ m }: { m: TeamMember }) {
  const dotColor =
    m.online === 'self'
      ? 'var(--success)'
      : ({ on: 'var(--success)', away: 'var(--amber)', off: 'var(--ink-4)' } as const)[m.online] ??
        'var(--ink-4)';
  const stateLabel =
    m.online === 'self'
      ? 'En ligne'
      : ({ on: 'En ligne', away: 'Absent', off: 'Hors ligne' } as const)[m.online] ?? '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          className="cp-avatar"
          style={{ width: 28, height: 28, fontSize: 10, background: m.color }}
        >
          {m.initials}
        </div>
        <span
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 9,
            height: 9,
            borderRadius: 5,
            background: dotColor,
            border: '2px solid var(--surface-2)',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {m.name}
          {m.online === 'self' && (
            <span style={{ color: 'var(--ink-4)', fontWeight: 500, marginLeft: 4 }}>(vous)</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
          {m.role} ·{' '}
          <span style={{ color: dotColor, fontWeight: 600 }}>{stateLabel}</span>
        </div>
      </div>
    </div>
  );
}

// FileRow retiré : section "Fichiers partagés" rendue en placeholder vide en v1
// (module documents pas encore wireé au chat).

function LinkedPatient({
  name,
  id,
  tag,
  tagColor,
}: {
  name: string;
  id: string;
  tag: string;
  tagColor: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        cursor: 'pointer',
      }}
    >
      <div className="cp-avatar" style={{ width: 28, height: 28, fontSize: 10, background: '#1E5AA8' }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
          {id}
        </div>
      </div>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 3,
          background: tagColor,
          color: 'white',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {tag}
      </span>
    </div>
  );
}

/**
 * Picker pour démarrer une DM avec un collègue. Liste les users actifs hors
 * caller (depuis /chat/colleagues). Clic → POST /chat/direct-messages
 * idempotent → sélection de la DM (existante ou créée).
 */
function ColleaguePicker({
  colleagues,
  loading,
  onPick,
  onClose,
}: {
  colleagues: { id: string; fullName: string; role: string | null }[];
  loading: boolean;
  onPick: (userId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un collègue pour démarrer une discussion"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 'min(420px, 92vw)',
          maxHeight: '80vh',
          background: 'var(--surface)',
          borderRadius: 10,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: 14 }}>Nouveau message</strong>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
            Choisissez un collègue pour ouvrir une discussion privée.
          </div>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: 18, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          )}
          {!loading && colleagues.length === 0 && (
            <div style={{ padding: 18, color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun autre collègue actif.
            </div>
          )}
          {colleagues.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 18px',
                border: 0,
                borderBottom: '1px solid var(--border-soft)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                color: 'var(--ink-1)',
                display: 'block',
              }}
            >
              {c.fullName}
              {c.role && (
                <span style={{ color: 'var(--ink-3)', marginLeft: 6, fontSize: 11.5 }}>
                  · {c.role}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
}
