// Mobile · Messages équipe — Liste des conversations

function MMessages() {
  const [tab, setTabState] = React.useState('all');

  const items = [
    { kind: 'channel', id: 'urgences', name: '#urgences', sub: "🚨 Khadija : Patient présent avec malaise — Box 2 prêt", time: '09:46', unread: 3, mentions: 1, members: 5, urgent: true },
    { kind: 'channel', id: 'general',  name: '#général',  sub: 'Fatima : Point matinée — M. Alami démarré (Box 1)', time: '09:31', unread: 0, mentions: 0, members: 5 },
    { kind: 'patient', id: 'p-alami',  name: 'Mohamed Alami',  sub: 'Suivi HTA · ajustement traitement',           pid: 'PT-00482', time: '09:35', unread: 1, mentions: 0, participants: 3 },
    { kind: 'dm', id: 'khadija', avatar: { initials: 'KI', color: '#B8500C' }, online: 'on', name: 'Khadija El Idrissi', role: 'Infirmière', sub: 'Tension OK pour M. Alami. Je vous remonte au dossier.', time: '09:18', unread: 2, mentions: 0 },
    { kind: 'dm', id: 'fatima',  avatar: { initials: 'FB', color: '#3F7A3A' }, online: 'on', name: 'Fatima Z. Benjelloun', role: 'Secrétaire', sub: 'Vous : Reçu, merci. Passe-la cet aprem.',     time: '09:43', unread: 0, mentions: 0, sent: true, read: true },
    { kind: 'channel', id: 'planning', name: '#planning', sub: 'Hassan : Je peux te couvrir vendredi matin',       time: 'Hier',  unread: 0, mentions: 0, members: 4 },
    { kind: 'patient', id: 'p-tazi',   name: 'Aïcha Tazi',     sub: 'Bilan HbA1c à reprogrammer',                  pid: 'PT-00471', time: '08:50', unread: 0, mentions: 0, participants: 2 },
    { kind: 'channel', id: 'pharma',   name: '#pharmacie',     sub: 'Nadia : Réception commande Amlor 5mg',         time: 'Hier',  unread: 7, mentions: 0, members: 3 },
    { kind: 'dm', id: 'hassan', avatar: { initials: 'HB', color: '#2A7CE7' }, online: 'off', name: 'Dr. Hassan Bennani', role: 'Médecin', sub: 'Je peux te couvrir vendredi.', time: 'Hier', unread: 0, mentions: 0, sent: true, read: false },
    { kind: 'dm', id: 'nadia',  avatar: { initials: 'NS', color: '#6B6B6B' }, online: 'away', name: 'Nadia Sefrioui', role: 'Aide-soignante', sub: 'Box 2 prêt.', time: 'Hier', unread: 0, mentions: 0 },
  ];

  const tabs = [
    { id: 'all',      label: 'Tout',     count: 13 },
    { id: 'mentions', label: 'Mentions', count: 1 },
    { id: 'unread',   label: 'Non lus',  count: 4 },
  ];

  const filtered = items.filter(it => {
    if (tab === 'mentions') return it.mentions > 0;
    if (tab === 'unread') return it.unread > 0;
    return true;
  });

  return (
    <MScreen
      tab="menu"
      topbar={
        <MTopbar
          title="Messages"
          sub="Équipe · 4 en ligne"
          right={
            <button style={{
              border: 0, background: 'transparent', cursor: 'pointer',
              color: 'var(--ink-2)', padding: 6,
            }}>
              <span style={{transform: 'scale(1.1)', display: 'inline-block'}}><Icon.Search /></span>
            </button>
          }
        />
      }
      fab={
        <button style={{
          position: 'absolute', right: 18, bottom: 92, zIndex: 10,
          width: 52, height: 52, borderRadius: 26, border: 0,
          background: 'var(--primary)', color: 'white',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(42,124,231,0.4), 0 2px 4px rgba(0,0,0,0.08)',
        }}>
          <span style={{transform: 'scale(1.3)'}}><Icon.Edit /></span>
        </button>
      }
    >
      {/* Tab strip */}
      <div style={{
        padding: '10px 16px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 8,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTabState(t.id)} style={{
            height: 30, padding: '0 12px', borderRadius: 15,
            border: '1px solid ' + (tab === t.id ? 'var(--primary)' : 'var(--border)'),
            background: tab === t.id ? 'var(--primary)' : 'var(--surface)',
            color: tab === t.id ? 'white' : 'var(--ink-2)',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>
            {t.label}
            <span className="tnum" style={{
              fontSize: 10.5, fontWeight: 700,
              color: tab === t.id ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)',
            }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Urgent banner */}
      {tab === 'all' && (
        <div style={{
          margin: '10px 16px 0', padding: '8px 12px',
          background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 12, background: 'var(--danger)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
            animation: 'mchat-pulse 1.4s ease-in-out infinite',
          }}>
            <span style={{color: 'white', transform: 'scale(0.85)'}}><Icon.Warn /></span>
          </span>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 11.5, fontWeight: 700, color: 'var(--danger)'}}>1 message urgent · #urgences</div>
            <div style={{fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              Khadija — Patient présent avec malaise
            </div>
          </div>
          <span style={{color: 'var(--danger)', transform: 'scale(1.1)'}}><Icon.ChevronRight /></span>
        </div>
      )}

      {/* List */}
      <div style={{padding: '4px 0'}}>
        {filtered.map(it => <MMessageRow key={it.id} it={it} />)}
      </div>

      <div style={{height: 16}} />
    </MScreen>
  );
}

function MMessageRow({ it }) {
  return (
    <div style={{
      padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      background: it.urgent ? 'rgba(168, 50, 30, 0.04)' : 'var(--surface)',
      borderBottom: '1px solid var(--border-soft)',
      borderLeft: it.urgent ? '3px solid var(--danger)' : '3px solid transparent',
      cursor: 'pointer',
    }}>
      {/* Avatar */}
      <div style={{position: 'relative', flexShrink: 0}}>
        {it.kind === 'channel' ? (
          <div style={{
            width: 42, height: 42, borderRadius: 8,
            background: it.urgent ? 'var(--danger-soft)' : 'var(--bg-alt)',
            border: '1px solid ' + (it.urgent ? 'var(--danger)' : 'var(--border)'),
            display: 'grid', placeItems: 'center',
            color: it.urgent ? 'var(--danger)' : 'var(--ink-2)',
            fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)',
          }}>#</div>
        ) : it.kind === 'patient' ? (
          <div style={{
            width: 42, height: 42, borderRadius: 8,
            background: 'var(--primary-soft)',
            border: '1px solid var(--primary)',
            display: 'grid', placeItems: 'center',
            color: 'var(--primary)',
          }}>
            <span style={{transform: 'scale(1.1)'}}><Icon.Stetho /></span>
          </div>
        ) : (
          <React.Fragment>
            <div className="cp-avatar" style={{
              width: 42, height: 42, fontSize: 14, background: it.avatar.color,
            }}>{it.avatar.initials}</div>
            <span style={{
              position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: 6,
              background: { on: 'var(--success)', away: 'var(--amber)', off: 'var(--ink-4)' }[it.online],
              border: '2px solid var(--surface)',
            }}/>
          </React.Fragment>
        )}
      </div>

      <div style={{flex: 1, minWidth: 0}}>
        {/* Row 1: name + time */}
        <div style={{display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2}}>
          <span style={{
            fontSize: 14, fontWeight: it.unread > 0 ? 700 : 600,
            color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{it.name}</span>
          {it.kind === 'patient' && (
            <span className="mono" style={{
              fontSize: 9.5, padding: '1px 4px', borderRadius: 3,
              background: 'var(--bg-alt)', color: 'var(--ink-3)', fontWeight: 700,
              flexShrink: 0,
            }}>{it.pid}</span>
          )}
          {it.kind === 'channel' && (
            <span style={{fontSize: 10.5, color: 'var(--ink-4)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2}}>
              <span style={{transform: 'scale(0.75)', display: 'inline-block'}}><Icon.Users /></span>
              <span className="tnum">{it.members}</span>
            </span>
          )}
          <span style={{flex: 1}} />
          <span className="tnum" style={{
            fontSize: 10.5,
            color: it.unread > 0 ? 'var(--primary)' : 'var(--ink-4)',
            fontWeight: it.unread > 0 ? 700 : 500,
            flexShrink: 0,
          }}>{it.time}</span>
        </div>

        {/* Role for DMs */}
        {it.kind === 'dm' && it.role && (
          <div style={{fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 3}}>{it.role}</div>
        )}

        {/* Row 2: preview + badges */}
        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
          {it.sent && (
            <span style={{
              color: it.read ? 'var(--primary)' : 'var(--ink-4)',
              flexShrink: 0, transform: 'scale(0.85)', display: 'inline-block',
            }}><Icon.CheckDouble /></span>
          )}
          <span style={{
            fontSize: 12.5,
            color: it.unread > 0 ? 'var(--ink-2)' : 'var(--ink-3)',
            fontWeight: it.unread > 0 ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>{it.sub}</span>
          {it.mentions > 0 && (
            <span className="tnum" style={{
              background: 'var(--danger)', color: 'white', fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 9, flexShrink: 0,
            }}>@{it.mentions}</span>
          )}
          {it.unread > 0 && !it.mentions && (
            <span className="tnum" style={{
              background: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 9, minWidth: 18, textAlign: 'center',
              flexShrink: 0,
            }}>{it.unread}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Mobile · Conversation view (#urgences)
// ════════════════════════════════════════════════════════════

function MConversation() {
  const team = {
    me:      { name: 'Vous',          role: 'Médecin',     initials: 'KE', color: '#1E5AA8' },
    fatima:  { name: 'Fatima',        role: 'Secrétaire',  initials: 'FB', color: '#3F7A3A' },
    khadija: { name: 'Khadija',       role: 'Infirmière',  initials: 'KI', color: '#B8500C' },
  };

  const messages = [
    { day: "Aujourd'hui" },
    { u: team.fatima,  side: 'left',  time: '09:30', text: "Bonjour à tous 👋 — point matinée :" },
    { u: team.fatima,  side: 'left',  time: '09:31', text: "• M. Alami démarré (Box 1)\n• Mme Bennani — constantes en cours\n• Mme Tazi annulée, rappel demain", grouped: true },
    { u: team.khadija, side: 'left',  time: '09:33', text: "TA de M. Alami à 135/85 — un peu élevée, je remonte au dossier." },
    { u: team.me,      side: 'right', time: '09:35', text: "Reçu Khadija, merci. On en parle pendant la consult.", read: true },
    { u: team.fatima,  side: 'left',  time: '09:42', text: "@Dr. El Amrani — M. Lahlou (73 ans, FA) demande à être appelé après 14h pour ses INR. Je le passe cet aprem ?" },
    { u: team.me,      side: 'right', time: '09:43', text: "Oui — note-le sur le créneau 14:30 si possible.", read: true },
    { u: team.khadija, side: 'left',  time: '09:46', text: "🚨 Patient présent en salle d'attente avec malaise — Box 2 prêt, j'ai besoin de toi ASAP", urgent: true },
  ];

  return (
    <MScreen
      tab="menu"
      noTabs
      topbar={
        <MConversationTopbar
          name="#urgences"
          sub="5 membres · 4 en ligne"
          urgent={true}
        />
      }
    >
      {/* Pinned banner */}
      <div style={{
        margin: '10px 12px', padding: '8px 10px',
        background: 'var(--amber-soft)', border: '1px solid var(--amber)', borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{color: 'var(--amber)', flexShrink: 0}}><Icon.Pin /></span>
        <span style={{fontSize: 11.5, color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          <strong style={{color: 'var(--amber)'}}>Épinglé :</strong> Protocole arrêt cardio-resp.
        </span>
        <span style={{fontSize: 10.5, color: 'var(--amber)', fontWeight: 700}}>Voir</span>
      </div>

      {/* Messages */}
      <div style={{padding: '4px 12px 12px'}}>
        {messages.map((m, i) => {
          if (m.day) return <MDayDivider key={i} label={m.day} />;
          return <MChatMessage key={i} m={m} />;
        })}

        {/* Typing */}
        <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px', color: 'var(--ink-3)', fontSize: 11.5}}>
          <div className="cp-avatar" style={{width: 22, height: 22, fontSize: 8.5, background: team.fatima.color}}>
            {team.fatima.initials}
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 14, background: 'var(--bg-alt)',
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}>
            <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--ink-3)', animation: 'mchat-dot 1.2s infinite'}}/>
            <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--ink-3)', animation: 'mchat-dot 1.2s infinite', animationDelay: '0.2s'}}/>
            <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--ink-3)', animation: 'mchat-dot 1.2s infinite', animationDelay: '0.4s'}}/>
          </div>
        </div>
      </div>

      {/* Composer */}
      <MComposer />
    </MScreen>
  );
}

function MConversationTopbar({ name, sub, urgent }) {
  return (
    <div className="mt" style={urgent ? {borderBottom: '2px solid var(--danger)'} : null}>
      <button style={{
        border: 0, background: 'transparent', cursor: 'pointer',
        padding: 4, marginRight: 4, color: 'var(--ink-2)',
      }}>
        <Icon.ChevronLeft />
      </button>
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        background: urgent ? 'var(--danger-soft)' : 'var(--bg-alt)',
        border: '1px solid ' + (urgent ? 'var(--danger)' : 'var(--border)'),
        display: 'grid', placeItems: 'center',
        color: urgent ? 'var(--danger)' : 'var(--ink-2)',
        fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)',
      }}>#</div>
      <div style={{flex: 1, minWidth: 0}}>
        <div className="mt-title" style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <span>{name}</span>
          {urgent && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px',
              background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 8,
              fontSize: 9, fontWeight: 700,
            }}>
              <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--danger)'}}/>
              URGENT
            </span>
          )}
        </div>
        <div className="mt-sub">{sub}</div>
      </div>
      <button style={{border: 0, background: 'transparent', cursor: 'pointer', padding: 6, color: 'var(--ink-2)'}}>
        <Icon.Phone />
      </button>
      <button style={{border: 0, background: 'transparent', cursor: 'pointer', padding: 6, color: 'var(--ink-2)'}}>
        <Icon.MoreH />
      </button>
    </div>
  );
}

function MDayDivider({ label }) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0'}}>
      <div style={{flex: 1, height: 1, background: 'var(--border-soft)'}}/>
      <span style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--ink-3)', padding: '2px 10px', background: 'var(--bg-alt)',
        borderRadius: 10,
      }}>{label}</span>
      <div style={{flex: 1, height: 1, background: 'var(--border-soft)'}}/>
    </div>
  );
}

function MChatMessage({ m }) {
  const isMe = m.side === 'right';
  return (
    <div style={{
      display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row',
      gap: 8, alignItems: 'flex-end',
      marginTop: m.grouped ? 2 : 8,
    }}>
      {!isMe && !m.grouped && (
        <div className="cp-avatar" style={{width: 26, height: 26, fontSize: 9.5, background: m.u.color, flexShrink: 0}}>
          {m.u.initials}
        </div>
      )}
      {!isMe && m.grouped && <div style={{width: 26, flexShrink: 0}}/>}

      <div style={{maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start'}}>
        {!isMe && !m.grouped && (
          <div style={{fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 3, paddingLeft: 4}}>
            {m.u.name} <span style={{color: 'var(--ink-4)', fontWeight: 500}}>· {m.u.role}</span>
          </div>
        )}

        <div style={{
          padding: '8px 12px',
          background: m.urgent
            ? 'var(--danger-soft)'
            : isMe ? 'var(--primary)' : 'var(--bg-alt)',
          color: m.urgent
            ? 'var(--ink)'
            : isMe ? 'white' : 'var(--ink)',
          border: m.urgent ? '1px solid var(--danger)' : 'none',
          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap',
        }}>
          {renderMobileText(m.text, isMe)}
        </div>

        <div style={{
          fontSize: 10, color: 'var(--ink-4)', marginTop: 3,
          padding: '0 4px',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <span className="tnum">{m.time}</span>
          {isMe && (
            <span style={{
              color: m.read ? 'var(--primary)' : 'var(--ink-4)',
              transform: 'scale(0.8)', display: 'inline-block',
            }}><Icon.CheckDouble /></span>
          )}
        </div>
      </div>
    </div>
  );
}

function renderMobileText(text, isMe) {
  const parts = text.split(/(@[A-Za-zÀ-ÿ.\s]+(?=\s|,|$))/g);
  return parts.map((p, i) => {
    if (p.startsWith('@')) {
      return (
        <span key={i} style={{
          background: isMe ? 'rgba(255,255,255,0.22)' : 'var(--primary-soft)',
          color: isMe ? 'white' : 'var(--primary)',
          padding: '0 4px', borderRadius: 3, fontWeight: 700,
        }}>{p.trim()}</span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function MComposer() {
  return (
    <div style={{
      flexShrink: 0, padding: '8px 10px 10px',
      borderTop: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
        <button style={{
          width: 36, height: 36, borderRadius: 18, border: 0,
          background: 'var(--bg-alt)', cursor: 'pointer',
          display: 'grid', placeItems: 'center', color: 'var(--ink-2)',
          flexShrink: 0,
        }}>
          <Icon.Plus />
        </button>
        <div style={{
          flex: 1, minHeight: 36, background: 'var(--bg-alt)', borderRadius: 18,
          display: 'flex', alignItems: 'center', padding: '0 4px 0 14px',
          gap: 4,
        }}>
          <input
            placeholder="Message #urgences"
            defaultValue="@Khadija j'arrive, prépare ECG + VVP"
            style={{
              flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent',
              fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)',
              padding: '8px 0',
            }}
          />
          <button style={{
            width: 28, height: 28, borderRadius: 14, border: 0,
            background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Icon.Smile />
          </button>
        </div>
        <button style={{
          width: 36, height: 36, borderRadius: 18, border: 0,
          background: 'var(--primary)', color: 'white', cursor: 'pointer',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: '0 2px 6px rgba(42,124,231,0.3)',
        }}>
          <Icon.Send />
        </button>
      </div>
    </div>
  );
}

// Animations
if (typeof document !== 'undefined' && !document.getElementById('mchat-anim-style')) {
  const st = document.createElement('style');
  st.id = 'mchat-anim-style';
  st.textContent = `
    @keyframes mchat-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(168,50,30,0.6); } 50% { box-shadow: 0 0 0 6px rgba(168,50,30,0); } }
    @keyframes mchat-dot { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }
  `;
  document.head.appendChild(st);
}

Object.assign(window, { MMessages, MConversation });
