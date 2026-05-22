/**
 * M12b — Conversation mobile (iso-maquette).
 *
 * ADR-035 v2 : tout vient du back via `useConversation(id)` — plus de fixtures.
 * La structure visuelle est conservée verbatim depuis `design/prototype/mobile/messages.jsx`.
 */
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import {
  Pin,
  ChevronLeft,
  Phone as PhoneIcon,
  MoreH,
  CheckDouble,
  Smile,
  Send,
} from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useConversation } from './hooks/useConversation';
import { useSendMessage } from './hooks/useSendMessage';
import type { ChatMessage, Conversation } from './types';
import './messages.css';

export default function MConversationMobilePage() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { data: convo } = useConversation(conversationId ?? null);
  const me = useAuthStore((s) => s.user);
  const sendMessage = useSendMessage();
  const [draft, setDraft] = useState('');

  const channelDisplayName = convo
    ? convo.kind === 'channel'
      ? '#' + convo.name
      : convo.name
    : '…';
  const isUrgentHeader = convo?.kind === 'channel' && convo.name === 'urgences';
  const sub = convo ? convo.topic || `${convo.members?.length ?? 0} membres` : '';

  function handleSend() {
    if (!conversationId || !draft.trim()) return;
    sendMessage.mutate({ conversationId, body: draft.trim() });
    setDraft('');
  }

  return (
    <MScreen
      tab="menu"
      noTabs
      topbar={
        <ConversationTopbar
          name={channelDisplayName}
          sub={sub}
          urgent={isUrgentHeader}
          onBack={() => navigate('/messages')}
        />
      }
    >
      {convo?.pinned ? <PinnedBar body={convo.pinnedBody ?? '—'} /> : null}

      <div style={{ padding: '4px 12px 12px' }}>
        {!convo ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 20 }}>Chargement…</div>
        ) : (
          flattenWithDayDividers(convo).map((entry, i) =>
            'day' in entry ? (
              <DayDivider key={'d' + i} label={entry.day} />
            ) : (
              <ChatBubble
                key={'m' + i}
                m={entry.message}
                meName={me ? `${me.firstName} ${me.lastName}`.trim() : ''}
              />
            ),
          )
        )}
        {convo?.typing && <TypingRow who={convo.typing} />}
      </div>

      <Composer value={draft} onChange={setDraft} onSend={handleSend} sending={sendMessage.isPending} />
    </MScreen>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

type FlatEntry = { day: string } | { message: ChatMessage };

function flattenWithDayDividers(convo: Conversation): FlatEntry[] {
  if (!convo.messages) return [];
  const out: FlatEntry[] = [];
  for (const d of convo.messages) {
    out.push({ day: d.day });
    for (const m of d.msgs) out.push({ message: m });
  }
  return out;
}

function PinnedBar({ body }: { body: string }) {
  return (
    <div
      style={{
        margin: '10px 12px',
        padding: '8px 10px',
        background: 'var(--amber-soft)',
        border: '1px solid var(--amber)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ color: 'var(--amber)', flexShrink: 0 }}>
        <Pin />
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--ink-2)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <strong style={{ color: 'var(--amber)' }}>Épinglé :</strong> {body}
      </span>
    </div>
  );
}

function ConversationTopbar({
  name,
  sub,
  urgent,
  onBack,
}: {
  name: string;
  sub: string;
  urgent?: boolean;
  onBack: () => void;
}) {
  return (
    <div className="mt" style={urgent ? { borderBottom: '2px solid var(--danger)' } : undefined}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Retour"
        style={{
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          padding: 4,
          marginRight: 4,
          color: 'var(--ink-2)',
        }}
      >
        <ChevronLeft />
      </button>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          flexShrink: 0,
          background: urgent ? 'var(--danger-soft)' : 'var(--bg-alt)',
          border: '1px solid ' + (urgent ? 'var(--danger)' : 'var(--border)'),
          display: 'grid',
          placeItems: 'center',
          color: urgent ? 'var(--danger)' : 'var(--ink-2)',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}
      >
        #
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mt-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{name}</span>
          {urgent && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 6px',
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                borderRadius: 8,
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--danger)' }} />
              URGENT
            </span>
          )}
        </div>
        <div className="mt-sub">{sub}</div>
      </div>
      <button
        type="button"
        aria-label="Appeler"
        style={{
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          padding: 6,
          color: 'var(--ink-2)',
        }}
      >
        <PhoneIcon />
      </button>
      <button
        type="button"
        aria-label="Plus d'actions"
        style={{
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          padding: 6,
          color: 'var(--ink-2)',
        }}
      >
        <MoreH />
      </button>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          padding: '2px 10px',
          background: 'var(--bg-alt)',
          borderRadius: 10,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
    </div>
  );
}

function ChatBubble({ m, meName }: { m: ChatMessage; meName: string }) {
  const isMe = m.u.name === meName || m.u.online === 'self';
  const text = m.text ?? '';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        gap: 8,
        alignItems: 'flex-end',
        marginTop: 8,
      }}
    >
      {!isMe && (
        <div
          className="cp-avatar"
          style={{ width: 26, height: 26, fontSize: 9.5, background: m.u.color, flexShrink: 0 }}
        >
          {m.u.initials}
        </div>
      )}

      <div
        style={{
          maxWidth: '78%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
        }}
      >
        {!isMe && (
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--ink-2)',
              marginBottom: 3,
              paddingLeft: 4,
            }}
          >
            {m.u.name}{' '}
            <span style={{ color: 'var(--ink-4)', fontWeight: 500 }}>· {m.u.role}</span>
          </div>
        )}

        <div
          style={{
            padding: '8px 12px',
            background: m.urgent
              ? 'var(--danger-soft)'
              : isMe
              ? 'var(--primary)'
              : 'var(--bg-alt)',
            color: m.urgent ? 'var(--ink)' : isMe ? 'white' : 'var(--ink)',
            border: m.urgent ? '1px solid var(--danger)' : 'none',
            borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            // Wrap des longues chaînes sans espaces (URLs, identifiants, B*4000)
            // pour empêcher la bulle de déborder du viewport mobile.
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            minWidth: 0,
          }}
        >
          {renderText(text, isMe)}
        </div>

        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-4)',
            marginTop: 3,
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <span className="tnum">{m.time}</span>
          {isMe && (
            <span
              style={{
                color: 'var(--ink-4)',
                transform: 'scale(0.8)',
                display: 'inline-block',
              }}
            >
              <CheckDouble />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function renderText(text: string, isMe: boolean) {
  const parts = text.split(/(@[A-Za-zÀ-ÿ.\s]+(?=\s|,|$))/g);
  return parts.map((p, i) => {
    if (p.startsWith('@')) {
      return (
        <span
          key={i}
          style={{
            background: isMe ? 'rgba(255,255,255,0.22)' : 'var(--primary-soft)',
            color: isMe ? 'white' : 'var(--primary)',
            padding: '0 4px',
            borderRadius: 3,
            fontWeight: 700,
          }}
        >
          {p.trim()}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function TypingRow({ who }: { who: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 4px',
        color: 'var(--ink-3)',
        fontSize: 11.5,
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderRadius: 14,
          background: 'var(--bg-alt)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        {[0, 0.2, 0.4].map((d) => (
          <span
            key={d}
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              background: 'var(--ink-3)',
              animation: 'mchat-dot 1.2s infinite',
              animationDelay: `${d}s`,
            }}
          />
        ))}
      </div>
      <span>
        <strong style={{ color: 'var(--ink-2)' }}>{who}</strong> écrit…
      </span>
    </div>
  );
}

// Cf. MessagesPage.tsx — même grille (sans dépendance externe).
const MOBILE_EMOJIS = [
  '👍', '👎', '🙏', '👌', '✅', '❌', '⚠️', '🚨',
  '💊', '🩺', '🩸', '🌡️', '💉', '🏥', '🚑', '🦷',
  '👋', '🤝', '👀', '🧠', '❤️', '🔥', '⏰', '📅',
  '💡', '📝', '📞', '🤔', '😊', '🙌', '👶', '👵',
];

function Composer({
  value,
  onChange,
  onSend,
  sending,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  function insertAtCursor(insert: string) {
    const el = inputRef.current;
    if (!el) {
      onChange(value + insert);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px 10px 10px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'relative',
      }}
    >
      {emojiOpen && (
        <>
          <div
            role="button"
            aria-label="Fermer le sélecteur d'émoticônes"
            tabIndex={-1}
            onClick={() => setEmojiOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div
            role="dialog"
            aria-label="Émoticônes"
            style={{
              position: 'absolute',
              bottom: 60,
              left: 10,
              right: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              zIndex: 100,
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: 2,
            }}
          >
            {MOBILE_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  insertAtCursor(e);
                  setEmojiOpen(false);
                }}
                aria-label={`Émoticône ${e}`}
                style={{
                  height: 34,
                  border: 0,
                  borderRadius: 6,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 20,
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Bouton pièce jointe retiré : pas de PJ en v1 (à remettre quand le
            module documents partagés sera wireé au chat). */}
        <div
          style={{
            flex: 1,
            minHeight: 36,
            background: 'var(--bg-alt)',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            padding: '0 4px 0 14px',
            gap: 4,
          }}
        >
          <input
            ref={inputRef}
            placeholder="Saisir un message"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              background: 'transparent',
              fontSize: 13.5,
              fontFamily: 'inherit',
              color: 'var(--ink)',
              padding: '8px 0',
            }}
          />
          <button
            type="button"
            aria-label="Ajouter une émoticône"
            aria-pressed={emojiOpen}
            onClick={() => setEmojiOpen((v) => !v)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              border: 0,
              background: emojiOpen ? 'var(--primary-soft)' : 'transparent',
              cursor: 'pointer',
              color: emojiOpen ? 'var(--primary)' : 'var(--ink-3)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Smile />
          </button>
        </div>
        <button
          type="button"
          aria-label="Envoyer"
          disabled={sending || !value.trim()}
          onClick={onSend}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: 0,
            background: 'var(--primary)',
            color: 'white',
            cursor: sending || !value.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !value.trim() ? 0.5 : 1,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(42,124,231,0.3)',
          }}
        >
          <Send />
        </button>
      </div>
    </div>
  );
}
