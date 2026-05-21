// Screen — Messages équipe (chat interne médecin ↔ staff)

function MessagesEquipe() {
  const [activeConvo, setActiveConvo] = React.useState('urgences');
  const [composer, setComposer] = React.useState("@Khadija — j'arrive en Box 2, prépare un ECG et VVP.");

  // ── Team
  const team = [
    { id: 'me',      name: 'Dr. Karim El Amrani',     role: 'Médecin',      initials: 'KE', color: '#1E5AA8', online: 'self' },
    { id: 'fatima',  name: 'Fatima Z. Benjelloun',    role: 'Secrétaire',   initials: 'FB', color: '#3F7A3A', online: 'on' },
    { id: 'khadija', name: 'Khadija El Idrissi',      role: 'Infirmière',   initials: 'KI', color: '#B8500C', online: 'on' },
    { id: 'nadia',   name: 'Nadia Sefrioui',          role: 'Aide-soignante', initials: 'NS', color: '#6B6B6B', online: 'away' },
    { id: 'hassan',  name: 'Dr. Hassan Bennani',      role: 'Médecin associé', initials: 'HB', color: '#2A7CE7', online: 'off' },
  ];

  const channels = [
    { id: 'general',  name: 'général',      sub: 'Toute l\'équipe',           unread: 0, mentions: 0, members: 5 },
    { id: 'urgences', name: 'urgences',     sub: 'Coordination cas urgents',  unread: 3, mentions: 1, members: 5 },
    { id: 'planning', name: 'planning',     sub: 'Agenda et remplacements',   unread: 0, mentions: 0, members: 4 },
    { id: 'pharma',   name: 'pharmacie',    sub: 'Stocks et commandes',       unread: 7, mentions: 0, members: 3 },
    { id: 'admin',    name: 'administratif', sub: 'CNSS, factures, CNOPS',    unread: 0, mentions: 0, members: 2 },
  ];

  const dms = [
    { id: 'fatima',   contact: team[1], last: "Mme Tazi a confirmé pour 16h.", time: '09:42', unread: 0, mentions: 0 },
    { id: 'khadija',  contact: team[2], last: "Tension OK pour M. Alami.",     time: '09:18', unread: 2, mentions: 0 },
    { id: 'hassan',   contact: team[4], last: "Je peux te couvrir vendredi.",  time: 'Hier',  unread: 0, mentions: 0 },
    { id: 'nadia',    contact: team[3], last: "Box 2 prêt.",                    time: 'Hier',  unread: 0, mentions: 0 },
  ];

  // Patient-linked conversations (a careplus original)
  const patientThreads = [
    { id: 'p-alami',   patient: 'Mohamed Alami',   pid: 'PT-00482', subj: 'Suivi HTA · ajustement traitement', participants: 3, time: '09:35', open: true, color: '#1E5AA8' },
    { id: 'p-tazi',    patient: 'Aïcha Tazi',      pid: 'PT-00471', subj: 'Bilan HbA1c à reprogrammer',         participants: 2, time: '08:50', open: true, color: '#2A7CE7' },
    { id: 'p-bennani', patient: 'Youssef Bennani', pid: 'PT-00476', subj: 'Vaccin rappel · maman à joindre',    participants: 3, time: 'Hier',  open: false, color: '#3F7A3A' },
  ];

  // ── Active conversation content (Urgences)
  const conversations = {
    urgences: {
      kind: 'channel',
      name: 'urgences',
      topic: 'Coordination des cas urgents et triage de la salle d\'attente',
      members: [team[0], team[1], team[2], team[3], team[4]],
      pinned: 1,
      messages: [
        { day: 'mercredi 23 avril', msgs: [
          { u: team[1], time: '14:22', text: "Mme El Khattabi (PT-00489) appelle pour douleurs thoraciques irradiantes depuis 30 min. Je lui dis de venir tout de suite ?", patient: { name: 'Sara El Khattabi', id: 'PT-00489', age: 58 } },
          { u: team[0], time: '14:23', text: "Oui — fais-la passer en priorité dès qu'elle arrive. @Khadija prépare un ECG dès l'arrivée.", mentions: ['Khadija'] },
          { u: team[2], time: '14:23', text: "Reçu. Box 2 libre, j'y vais.", reactions: [{ emoji: '👍', count: 2 }] },
        ]},
        { day: "aujourd'hui · vendredi 25 avril", msgs: [
          { u: team[1], time: '09:30', text: "Bonjour à tous 👋 — petit point sur la matinée :", reactions: [{ emoji: '☕', count: 3 }] },
          { u: team[1], time: '09:31', text: "• M. Alami démarré (Box 1)\n• Mme Bennani arrivée — constantes en cours\n• Mme Tazi annulée pour ce matin, rappel demain", system: false },
          { u: team[2], time: '09:33', text: "TA de M. Alami à 135/85 — un peu élevée, je vous remonte tout au dossier.", reply: { count: 2, last: 'Dr. El Amrani · il y a 8 min' } },
          { u: team[0], time: '09:35', text: "Reçu Khadija, merci. On en reparle pendant la consult.", system: false },
          { u: team[1], time: '09:42', text: "@Dr. El Amrani — M. Lahlou (73 ans, FA) demande à être appelé après 14h pour résultats INR. Je peux le passer cet aprem ?", mentions: ['Dr. El Amrani'], urgent: false },
          { u: team[0], time: '09:43', text: "Oui — note-le sur le créneau 14:30 si possible.", system: false },
          { u: team[2], time: '09:46', text: "🚨 Patient présent en salle d'attente avec malaise — Box 2 prêt, j'ai besoin de toi ASAP", urgent: true, mentions: [], reactions: [{ emoji: '👀', count: 1 }] },
        ]},
      ],
      typing: 'Dr. El Amrani',
    },
    general: { kind: 'channel', name: 'général', topic: "Espace équipe", members: [team[0], team[1], team[2], team[3], team[4]] },
    fatima:  { kind: 'dm', contact: team[1] },
  };

  const convo = conversations[activeConvo] || conversations.urgences;

  return (
    <Screen
      active="messages"
      title="Messages équipe"
      sub="5 membres · 4 en ligne"
      topbarRight={(
        <React.Fragment>
          <button className="btn"><Icon.Filter /> Tous</button>
          <button className="btn primary"><Icon.Plus /> Nouveau message</button>
        </React.Fragment>
      )}
    >
      <div style={{display: 'grid', gridTemplateColumns: '260px 1fr 280px', height: '100%', overflow: 'hidden'}}>

        {/* ─── Left rail: channels + DMs + patient threads ─── */}
        <ChatLeftRail
          channels={channels}
          dms={dms}
          patientThreads={patientThreads}
          active={activeConvo}
          onSelect={setActiveConvo}
        />

        {/* ─── Center: conversation thread ─── */}
        <div style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)'}}>
          <ConvoHeader convo={convo} />
          <ConvoMessages convo={convo} team={team} />
          <ConvoComposer value={composer} onChange={setComposer} typing={convo.typing} />
        </div>

        {/* ─── Right: members / shared files / patient context ─── */}
        <ChatRightRail convo={convo} team={team} />
      </div>
    </Screen>
  );
}

// ════════════════════════════════════════════════════════════
// Left rail
// ════════════════════════════════════════════════════════════
function ChatLeftRail({ channels, dms, patientThreads, active, onSelect }) {
  return (
    <div style={{
      borderRight: '1px solid var(--border)', background: 'var(--surface-2)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Search */}
      <div style={{padding: '12px 12px 8px', flexShrink: 0}}>
        <div style={{
          height: 32, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 10px',
          gap: 8, color: 'var(--ink-3)', fontSize: 12.5,
        }}>
          <Icon.Search />
          <span>Rechercher une conversation</span>
          <span style={{marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-4)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 3}}>⌘K</span>
        </div>
      </div>

      <div className="scroll" style={{overflow: 'auto', flex: 1, padding: '4px 8px 12px'}}>
        {/* Channels */}
        <RailHeader label="Canaux" count={channels.length} action="Ajouter" />
        {channels.map(c => (
          <ChannelRow key={c.id} c={c} active={active === c.id} onClick={() => onSelect(c.id)} />
        ))}

        {/* DMs */}
        <RailHeader label="Messages directs" count={4} action="Nouveau" mt={14} />
        {dms.map(d => (
          <DMRow key={d.id} d={d} active={active === d.id} onClick={() => onSelect(d.id)} />
        ))}

        {/* Patient threads */}
        <RailHeader label="Fils patient" count={3} action="" mt={14} hint />
        {patientThreads.map(p => (
          <PatientThreadRow key={p.id} p={p} active={active === p.id} onClick={() => onSelect(p.id)} />
        ))}
      </div>

      {/* Status footer */}
      <div style={{
        flexShrink: 0, padding: '8px 12px', borderTop: '1px solid var(--border)',
        background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div className="cp-avatar" style={{width: 26, height: 26, fontSize: 10, background: '#1E5AA8', position: 'relative'}}>
          KE
          <span style={{
            position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 5,
            background: 'var(--success)', border: '2px solid var(--bg-alt)',
          }}/>
        </div>
        <div style={{minWidth: 0, flex: 1, fontSize: 11.5}}>
          <div style={{fontWeight: 600, color: 'var(--ink)'}}>Dr. K. El Amrani</div>
          <div style={{color: 'var(--success)', fontSize: 10.5, fontWeight: 600}}>● En ligne</div>
        </div>
        <button className="btn icon ghost" style={{height: 26, width: 26, padding: 0}}>
          <Icon.MoreH />
        </button>
      </div>
    </div>
  );
}

function RailHeader({ label, count, action, mt, hint }) {
  return (
    <div style={{
      marginTop: mt || 4, padding: '6px 6px 4px',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: 'var(--ink-3)',
      }}>{label}</span>
      <span className="tnum" style={{fontSize: 10, color: 'var(--ink-4)'}}>{count}</span>
      <span style={{flex: 1}} />
      {action && (
        <button style={{
          background: 'transparent', border: 0, color: 'var(--ink-3)', cursor: 'pointer',
          fontSize: 10.5, fontWeight: 600, padding: '2px 4px', display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <Icon.Plus />
        </button>
      )}
      {hint && (
        <span title="Conversations rattachées à un dossier patient" style={{
          fontSize: 9, color: 'var(--primary)', background: 'var(--primary-soft)',
          padding: '1px 5px', borderRadius: 3, fontWeight: 700, letterSpacing: '0.04em',
        }}>NEW</span>
      )}
    </div>
  );
}

function ChannelRow({ c, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 8,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? 'white' : (c.unread > 0 ? 'var(--ink)' : 'var(--ink-2)'),
    }}>
      <span style={{
        fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)',
        opacity: active ? 1 : 0.6,
      }}>#</span>
      <span style={{
        flex: 1, fontSize: 12.5, fontWeight: c.unread > 0 ? 700 : 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{c.name}</span>
      {c.mentions > 0 && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.2)' : 'var(--danger)',
          color: 'white', fontSize: 9.5, fontWeight: 700,
          padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center',
        }} className="tnum">@{c.mentions}</span>
      )}
      {c.unread > 0 && !c.mentions && (
        <span className="tnum" style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--ink)',
          color: 'white', fontSize: 9.5, fontWeight: 700,
          padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center',
        }}>{c.unread}</span>
      )}
    </div>
  );
}

function DMRow({ d, active, onClick }) {
  const dot = { on: 'var(--success)', away: 'var(--amber)', off: 'var(--ink-4)' }[d.contact.online] || 'var(--ink-4)';
  return (
    <div onClick={onClick} style={{
      padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 9,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? 'white' : 'var(--ink-2)',
    }}>
      <div style={{position: 'relative', flexShrink: 0}}>
        <div className="cp-avatar" style={{
          width: 22, height: 22, fontSize: 9, background: d.contact.color,
        }}>{d.contact.initials}</div>
        <span style={{
          position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: 4,
          background: dot, border: '1.5px solid ' + (active ? 'var(--primary)' : 'var(--surface-2)'),
        }}/>
      </div>
      <span style={{
        flex: 1, fontSize: 12.5, fontWeight: d.unread > 0 ? 700 : 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{d.contact.name}</span>
      {d.unread > 0 && (
        <span className="tnum" style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--ink)',
          color: 'white', fontSize: 9.5, fontWeight: 700,
          padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center',
        }}>{d.unread}</span>
      )}
    </div>
  );
}

function PatientThreadRow({ p, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '7px 8px', borderRadius: 4, cursor: 'pointer',
      display: 'flex', alignItems: 'flex-start', gap: 8,
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? 'white' : 'inherit',
    }}>
      <span style={{
        marginTop: 5, width: 5, height: 5, borderRadius: 3, flexShrink: 0,
        background: p.open ? (active ? 'rgba(255,255,255,0.8)' : p.color) : 'var(--ink-4)',
      }}/>
      <div style={{minWidth: 0, flex: 1}}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: active ? 'white' : 'var(--ink-2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{p.patient}</div>
        <div style={{
          fontSize: 10.5,
          color: active ? 'rgba(255,255,255,0.8)' : 'var(--ink-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginTop: 1,
        }}>{p.subj}</div>
      </div>
      <span className="tnum" style={{
        fontSize: 9.5,
        color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)',
        fontWeight: 600, flexShrink: 0, marginTop: 1,
      }}>{p.time}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Center: header
// ════════════════════════════════════════════════════════════
function ConvoHeader({ convo }) {
  return (
    <div style={{
      flexShrink: 0, padding: '14px 24px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{
            fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 700,
          }}>#</span>
          <span style={{fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em'}}>{convo.name || 'urgences'}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
            background: 'var(--danger-soft)', color: 'var(--danger)', borderRadius: 10,
            fontSize: 10.5, fontWeight: 700, marginLeft: 4,
          }}>
            <span style={{width: 5, height: 5, borderRadius: 3, background: 'var(--danger)'}}/>
            URGENT
          </span>
        </div>
        <div style={{fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, maxWidth: 460}}>
          {convo.topic || 'Coordination des cas urgents et triage de la salle d\'attente'}
        </div>
      </div>

      <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8}}>
        {/* Member avatars stack */}
        <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
          {(convo.members || []).slice(0, 4).map((m, i) => (
            <div key={m.id} className="cp-avatar" style={{
              width: 26, height: 26, fontSize: 9.5,
              background: m.color, marginLeft: i === 0 ? 0 : -8,
              border: '2px solid var(--surface)',
            }}>{m.initials}</div>
          ))}
          {(convo.members || []).length > 4 && (
            <div style={{
              width: 26, height: 26, borderRadius: '50%', marginLeft: -8,
              background: 'var(--bg-alt)', color: 'var(--ink-2)',
              border: '2px solid var(--surface)', display: 'grid', placeItems: 'center',
              fontSize: 9.5, fontWeight: 700,
            }}>+{convo.members.length - 4}</div>
          )}
        </div>
        <button className="btn sm ghost"><Icon.Pin /> {convo.pinned || 1}</button>
        <button className="btn sm ghost"><Icon.MoreH /></button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Center: message list
// ════════════════════════════════════════════════════════════
function ConvoMessages({ convo, team }) {
  return (
    <div className="scroll" style={{flex: 1, overflow: 'auto', padding: '0 0 12px'}}>
      {/* Pinned banner */}
      <div style={{
        margin: '12px 24px 8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--amber-soft)', border: '1px solid var(--amber)', borderRadius: 6,
        fontSize: 11.5,
      }}>
        <span style={{color: 'var(--amber)'}}><Icon.Pin /></span>
        <span style={{color: 'var(--amber)', fontWeight: 700}}>Épinglé :</span>
        <span style={{color: 'var(--ink-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          Protocole arrêt cardio-resp. — voir <span style={{color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline'}}>fiche pratique #urg-001</span>
        </span>
        <button style={{background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--amber)', fontSize: 11, fontWeight: 600}}>Voir</button>
      </div>

      {(convo.messages || []).map((day, di) => (
        <div key={di}>
          <DayDivider label={day.day} />
          {day.msgs.map((m, mi) => (
            <Message key={mi} m={m} previousFromSameUser={mi > 0 && day.msgs[mi-1].u.id === m.u.id && !day.msgs[mi-1].patient} />
          ))}
        </div>
      ))}

      {/* Typing indicator */}
      <div style={{padding: '6px 24px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-3)', fontSize: 11.5}}>
        <span style={{display: 'inline-flex', gap: 2, alignItems: 'center'}}>
          <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--ink-3)', animation: 'chatdot 1.2s infinite', animationDelay: '0s'}}/>
          <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--ink-3)', animation: 'chatdot 1.2s infinite', animationDelay: '0.2s'}}/>
          <span style={{width: 4, height: 4, borderRadius: 2, background: 'var(--ink-3)', animation: 'chatdot 1.2s infinite', animationDelay: '0.4s'}}/>
        </span>
        <span><strong style={{color: 'var(--ink-2)'}}>Fatima</strong> est en train d'écrire…</span>
      </div>
    </div>
  );
}

function DayDivider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 24px 6px', position: 'sticky', top: 0,
      background: 'linear-gradient(to bottom, var(--surface) 70%, transparent)',
      zIndex: 5,
    }}>
      <div style={{flex: 1, height: 1, background: 'var(--border)'}}/>
      <span style={{
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--ink-3)', padding: '2px 10px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 12,
      }}>{label}</span>
      <div style={{flex: 1, height: 1, background: 'var(--border)'}}/>
    </div>
  );
}

function Message({ m, previousFromSameUser }) {
  const isUrgent = m.urgent;
  return (
    <div style={{
      padding: previousFromSameUser ? '2px 24px 2px 70px' : '8px 24px 4px',
      display: 'flex', gap: 12,
      background: isUrgent ? 'var(--danger-soft)' : 'transparent',
      borderLeft: isUrgent ? '3px solid var(--danger)' : '3px solid transparent',
    }}>
      {previousFromSameUser ? (
        <div style={{width: 34, flexShrink: 0}}/>
      ) : (
        <div className="cp-avatar" style={{
          width: 34, height: 34, fontSize: 11.5, background: m.u.color, flexShrink: 0,
        }}>{m.u.initials}</div>
      )}
      <div style={{flex: 1, minWidth: 0}}>
        {!previousFromSameUser && (
          <div style={{display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2}}>
            <span style={{fontSize: 13.5, fontWeight: 700, color: 'var(--ink)'}}>{m.u.name}</span>
            <span style={{
              fontSize: 10, padding: '1px 5px', borderRadius: 3,
              background: 'var(--bg-alt)', color: 'var(--ink-3)', fontWeight: 600,
            }}>{m.u.role}</span>
            <span className="tnum" style={{fontSize: 11, color: 'var(--ink-4)'}}>{m.time}</span>
          </div>
        )}
        <MessageBody text={m.text} mentions={m.mentions} />
        {m.patient && <PatientAttachCard p={m.patient} />}
        {m.reactions && (
          <div style={{display: 'flex', gap: 4, marginTop: 6}}>
            {m.reactions.map((r, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 7px', borderRadius: 11,
                background: 'var(--primary-soft)', border: '1px solid var(--primary)',
                fontSize: 11, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer',
              }}>
                <span>{r.emoji}</span>
                <span className="tnum">{r.count}</span>
              </span>
            ))}
            <button style={{
              padding: '2px 7px', borderRadius: 11,
              background: 'var(--surface)', border: '1px dashed var(--border-strong)',
              fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Icon.Smile />
            </button>
          </div>
        )}
        {m.reply && (
          <div style={{
            marginTop: 6, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            fontSize: 11, cursor: 'pointer',
          }}>
            <span style={{color: 'var(--primary)', fontWeight: 700}}>{m.reply.count} réponses</span>
            <span style={{color: 'var(--ink-3)'}}>· dernière {m.reply.last}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBody({ text, mentions }) {
  // Naive mention highlighting
  const parts = text.split(/(@[A-Za-zÀ-ÿ.\s]+(?=\s|,|$))/g);
  return (
    <div style={{
      fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
    }}>
      {parts.map((p, i) => {
        if (p.startsWith('@')) {
          return <span key={i} style={{
            background: 'var(--primary-soft)', color: 'var(--primary)',
            padding: '0 4px', borderRadius: 3, fontWeight: 600,
          }}>{p.trim()}</span>;
        }
        return <span key={i}>{p}</span>;
      })}
    </div>
  );
}

function PatientAttachCard({ p }) {
  return (
    <div style={{
      marginTop: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface)', border: '1px solid var(--primary)',
      borderLeft: '4px solid var(--primary)', borderRadius: 4,
      maxWidth: 380,
    }}>
      <div className="cp-avatar" style={{width: 30, height: 30, fontSize: 10, background: '#1E5AA8'}}>
        {p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 12.5, fontWeight: 700, color: 'var(--ink)'}}>{p.name}</div>
        <div className="mono" style={{fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1}}>
          {p.id} · {p.age} ans
        </div>
      </div>
      <button className="btn sm" style={{background: 'var(--primary)', color: 'white', border: 0}}>
        Ouvrir dossier
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Composer
// ════════════════════════════════════════════════════════════
function ConvoComposer({ value, onChange }) {
  return (
    <div style={{
      flexShrink: 0, padding: '12px 24px 16px',
      borderTop: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div style={{
        border: '1px solid var(--border-strong)', borderRadius: 8,
        background: 'var(--surface)', boxShadow: '0 0 0 3px rgba(42, 124, 231, 0.08)',
      }}>
        {/* Patient context chip */}
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '2px 7px', borderRadius: 10,
            background: 'var(--primary-soft)', border: '1px solid var(--primary)',
            fontSize: 10.5, fontWeight: 700, color: 'var(--primary)',
          }}>
            <span style={{width: 5, height: 5, borderRadius: 3, background: 'var(--primary)'}}/>
            Rattaché : Sara El Khattabi · PT-00489
            <span style={{color: 'var(--primary)', opacity: 0.6, marginLeft: 2, cursor: 'pointer'}}>×</span>
          </span>
          <span style={{marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-4)'}}>
            Visible par 5 membres du canal #urgences
          </span>
        </div>

        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Message #urgences — utilisez @ pour mentionner, # pour un canal"
          style={{
            width: '100%', border: 0, outline: 0, resize: 'none',
            padding: '10px 12px', fontSize: 13, fontFamily: 'inherit',
            color: 'var(--ink)', background: 'transparent', boxSizing: 'border-box',
            minHeight: 56, maxHeight: 120,
          }}
        />

        {/* Toolbar */}
        <div style={{
          padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 2,
          borderTop: '1px solid var(--border-soft)',
        }}>
          <ComposerBtn icon="Paperclip" />
          <ComposerBtn icon="At" />
          <ComposerBtn icon="Smile" />
          <ComposerBtn icon="Stetho" label="Patient" />
          <ComposerBtn icon="Mic" />
          <span style={{flex: 1}} />
          <span style={{fontSize: 10.5, color: 'var(--ink-4)', marginRight: 8}}>
            <span className="mono" style={{
              padding: '1px 5px', border: '1px solid var(--border)', borderRadius: 3,
              fontSize: 10, color: 'var(--ink-3)',
            }}>⏎</span>
            <span style={{marginLeft: 4}}>pour envoyer</span>
          </span>
          <button className="btn sm primary" style={{height: 28, padding: '0 12px', gap: 6}}>
            <Icon.Send /> Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}

function ComposerBtn({ icon, label }) {
  const Ico = Icon[icon];
  return (
    <button style={{
      height: 26, padding: label ? '0 8px' : '0 6px', border: 0, borderRadius: 4,
      background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)',
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 500,
    }}>
      <Ico />
      {label && <span>{label}</span>}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// Right rail
// ════════════════════════════════════════════════════════════
function ChatRightRail({ convo, team }) {
  return (
    <div className="scroll" style={{
      borderLeft: '1px solid var(--border)', background: 'var(--surface-2)',
      overflow: 'auto', padding: '14px 14px 24px',
    }}>
      <SectionLabel>À propos</SectionLabel>
      <div style={{fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 12}}>
        Coordination des cas urgents — triage SA, transferts, arrêts cardio-resp.
        Créé le 12 février 2025.
      </div>

      <SectionLabel>Membres · 5</SectionLabel>
      <div style={{marginBottom: 14}}>
        {(convo.members || team).map(m => (
          <MemberRow key={m.id} m={m} />
        ))}
        <button className="btn sm ghost" style={{width: '100%', justifyContent: 'flex-start', marginTop: 4}}>
          <Icon.Plus /> Inviter un membre
        </button>
      </div>

      <SectionLabel>Fichiers partagés · 4</SectionLabel>
      <div style={{display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14}}>
        <FileRow name="ECG_Alami_25-04.pdf" sub="par Khadija · 09:33" type="pdf" />
        <FileRow name="Protocole_AVC.pdf" sub="épinglé · pratique #urg-002" type="pdf" />
        <FileRow name="Tension_recap.xlsx" sub="par Fatima · hier" type="xls" />
        <FileRow name="Photo_lesion.jpg" sub="Mme Tazi · 23 avr" type="img" />
      </div>

      <SectionLabel>Patients liés · 2</SectionLabel>
      <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
        <LinkedPatient name="Sara El Khattabi" id="PT-00489" tag="Triage en cours" tagColor="var(--danger)" />
        <LinkedPatient name="Mohamed Alami"     id="PT-00482" tag="HTA · suivi" tagColor="var(--primary)" />
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--ink-3)', marginBottom: 8,
    }}>{children}</div>
  );
}

function MemberRow({ m }) {
  const dotColor = m.online === 'self' ? 'var(--success)' :
                   { on: 'var(--success)', away: 'var(--amber)', off: 'var(--ink-4)' }[m.online];
  const stateLabel = m.online === 'self' ? 'En ligne' :
                     { on: 'En ligne', away: 'Absent', off: 'Hors ligne' }[m.online];
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0'}}>
      <div style={{position: 'relative', flexShrink: 0}}>
        <div className="cp-avatar" style={{width: 28, height: 28, fontSize: 10, background: m.color}}>
          {m.initials}
        </div>
        <span style={{
          position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: 5,
          background: dotColor, border: '2px solid var(--surface-2)',
        }}/>
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {m.name}{m.online === 'self' && <span style={{color: 'var(--ink-4)', fontWeight: 500, marginLeft: 4}}>(vous)</span>}
        </div>
        <div style={{fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1}}>
          {m.role} · <span style={{color: dotColor, fontWeight: 600}}>{stateLabel}</span>
        </div>
      </div>
    </div>
  );
}

function FileRow({ name, sub, type }) {
  const colors = { pdf: '#A8321E', xls: '#3F7A3A', img: '#2A7CE7' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 4, background: colors[type] || '#6B6B6B',
        color: 'white', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700,
        flexShrink: 0, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
      }}>{type}</div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{name}</div>
        <div style={{fontSize: 10, color: 'var(--ink-3)', marginTop: 1}}>{sub}</div>
      </div>
    </div>
  );
}

function LinkedPatient({ name, id, tag, tagColor }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div style={{
      padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 4, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer',
    }}>
      <div className="cp-avatar" style={{width: 28, height: 28, fontSize: 10, background: '#1E5AA8'}}>{initials}</div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 12, fontWeight: 600, color: 'var(--ink)'}}>{name}</div>
        <div className="mono" style={{fontSize: 10, color: 'var(--ink-3)', marginTop: 1}}>{id}</div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
        background: tagColor, color: 'white', textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>{tag}</span>
    </div>
  );
}

// Pulse animation
if (typeof document !== 'undefined' && !document.getElementById('chat-anim-style')) {
  const st = document.createElement('style');
  st.id = 'chat-anim-style';
  st.textContent = '@keyframes chatdot { 0%, 60%, 100% { opacity: 0.3 } 30% { opacity: 1 } }';
  document.head.appendChild(st);
}

window.MessagesEquipe = MessagesEquipe;
