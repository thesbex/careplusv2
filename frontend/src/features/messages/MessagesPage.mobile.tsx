/**
 * M12 — Messages équipe (liste mobile).
 *
 * Port verbatim de design/prototype/mobile/messages.jsx vers React/TSX,
 * variante "MMessages". Mockup IHM, fixtures uniquement (./fixtures.ts).
 * Cliquer un canal/DM/fil patient ouvre la conversation (M12b) via
 * navigate('/messages/<id>') — la même URL deep-linkable utilisée par le
 * dossier patient.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import {
  Search,
  Edit,
  Warn,
  ChevronRight,
  Stetho,
  Users,
  CheckDouble,
} from '@/components/icons';
import { useMobileList } from './hooks/useMobileList';
import { useTeam } from './hooks/useTeam';
import type { MobileListItem } from './types';
import './messages.css';

type Tab = 'all' | 'mentions' | 'unread';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'unread', label: 'Non lus' },
];

export default function MessagesMobilePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const { items: mobileListItems } = useMobileList();
  const { data: team = [] } = useTeam();

  const filtered = mobileListItems.filter((it) => {
    if (tab === 'mentions') return it.mentions > 0;
    if (tab === 'unread') return it.unread > 0;
    return true;
  });

  const counts: Record<Tab, number> = {
    all: mobileListItems.length,
    mentions: mobileListItems.filter((it) => it.mentions > 0).length,
    unread: mobileListItems.filter((it) => it.unread > 0).length,
  };

  const onlineCount = team.filter((m) => m.online === 'on' || m.online === 'self').length;
  const subline =
    team.length > 0 ? `Équipe · ${onlineCount} en ligne` : 'Messagerie interne';

  // Detect le message urgent le plus récent — détermine le banner orange "1 message urgent".
  const urgentChannel = mobileListItems.find((it) => it.urgent);

  return (
    <MScreen
      tab="menu"
      topbar={
        <MTopbar
          title="Messages"
          sub={subline}
          right={
            <button
              type="button"
              aria-label="Rechercher"
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--ink-2)',
                padding: 6,
              }}
            >
              <span style={{ transform: 'scale(1.1)', display: 'inline-block' }}>
                <Search />
              </span>
            </button>
          }
        />
      }
      fab={
        <button
          type="button"
          aria-label="Nouveau message"
          style={{
            position: 'absolute',
            right: 18,
            bottom: 92,
            zIndex: 10,
            width: 52,
            height: 52,
            borderRadius: 26,
            border: 0,
            background: 'var(--primary)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(42,124,231,0.4), 0 2px 4px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ transform: 'scale(1.3)' }}>
            <Edit />
          </span>
        </button>
      }
    >
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
        }}
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: 15,
                border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                background: on ? 'var(--primary)' : 'var(--surface)',
                color: on ? 'white' : 'var(--ink-2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.label}
              <span
                className="tnum"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: on ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)',
                }}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'all' && urgentChannel && (
        <button
          type="button"
          onClick={() => navigate(`/messages/${urgentChannel.id}`)}
          style={{
            margin: '10px 16px 0',
            padding: '8px 12px',
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: 'calc(100% - 32px)',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              background: 'var(--danger)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              animation: 'mchat-pulse 1.4s ease-in-out infinite',
            }}
          >
            <span style={{ color: 'white', transform: 'scale(0.85)' }}>
              <Warn />
            </span>
          </span>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--danger)' }}>
              Message urgent · {urgentChannel.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {urgentChannel.sub}
            </div>
          </div>
          <span style={{ color: 'var(--danger)', transform: 'scale(1.1)' }}>
            <ChevronRight />
          </span>
        </button>
      )}

      <div style={{ padding: '4px 0' }}>
        {filtered.map((it) => (
          <MessageRow key={it.id} it={it} onOpen={() => navigate(`/messages/${it.id}`)} />
        ))}
      </div>

      <div style={{ height: 16 }} />
    </MScreen>
  );
}

function MessageRow({ it, onOpen }: { it: MobileListItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="m-row"
      onClick={onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        background: it.urgent ? 'rgba(168, 50, 30, 0.04)' : 'var(--surface)',
        borderBottom: '1px solid var(--border-soft)',
        borderLeft: it.urgent ? '3px solid var(--danger)' : '3px solid transparent',
        cursor: 'pointer',
        border: 0,
        font: 'inherit',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {it.kind === 'channel' ? (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              background: it.urgent ? 'var(--danger-soft)' : 'var(--bg-alt)',
              border: '1px solid ' + (it.urgent ? 'var(--danger)' : 'var(--border)'),
              display: 'grid',
              placeItems: 'center',
              color: it.urgent ? 'var(--danger)' : 'var(--ink-2)',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            #
          </div>
        ) : it.kind === 'patient' ? (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 8,
              background: 'var(--primary-soft)',
              border: '1px solid var(--primary)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--primary)',
            }}
          >
            <span style={{ transform: 'scale(1.1)' }}>
              <Stetho />
            </span>
          </div>
        ) : (
          <>
            <div
              className="cp-avatar"
              style={{
                width: 42,
                height: 42,
                fontSize: 14,
                background: it.avatar?.color ?? '#6B6B6B',
              }}
            >
              {it.avatar?.initials ?? '?'}
            </div>
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 11,
                height: 11,
                borderRadius: 6,
                background:
                  it.online === 'on'
                    ? 'var(--success)'
                    : it.online === 'away'
                    ? 'var(--amber)'
                    : 'var(--ink-4)',
                border: '2px solid var(--surface)',
              }}
            />
          </>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: it.unread > 0 ? 700 : 600,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {it.name}
          </span>
          {it.kind === 'patient' && it.pid && (
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                padding: '1px 4px',
                borderRadius: 3,
                background: 'var(--bg-alt)',
                color: 'var(--ink-3)',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {it.pid}
            </span>
          )}
          {it.kind === 'channel' && typeof it.members === 'number' && (
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--ink-4)',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ transform: 'scale(0.75)', display: 'inline-block' }}>
                <Users />
              </span>
              <span className="tnum">{it.members}</span>
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span
            className="tnum"
            style={{
              fontSize: 10.5,
              color: it.unread > 0 ? 'var(--primary)' : 'var(--ink-4)',
              fontWeight: it.unread > 0 ? 700 : 500,
              flexShrink: 0,
            }}
          >
            {it.time}
          </span>
        </div>

        {it.kind === 'dm' && it.role && (
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 3 }}>{it.role}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {it.sent && (
            <span
              style={{
                color: it.read ? 'var(--primary)' : 'var(--ink-4)',
                flexShrink: 0,
                transform: 'scale(0.85)',
                display: 'inline-block',
              }}
            >
              <CheckDouble />
            </span>
          )}
          <span
            style={{
              fontSize: 12.5,
              color: it.unread > 0 ? 'var(--ink-2)' : 'var(--ink-3)',
              fontWeight: it.unread > 0 ? 500 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {it.sub}
          </span>
          {it.mentions > 0 && (
            <span
              className="tnum"
              style={{
                background: 'var(--danger)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 9,
                flexShrink: 0,
              }}
            >
              @{it.mentions}
            </span>
          )}
          {it.unread > 0 && it.mentions === 0 && (
            <span
              className="tnum"
              style={{
                background: 'var(--primary)',
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 9,
                minWidth: 18,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {it.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
