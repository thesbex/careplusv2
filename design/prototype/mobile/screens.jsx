// Mobile screens: agenda, rdv, dossier, salle, constantes, consultation,
// prescription, ordonnance-preview, facturation, facture-preview,
// parametrage, login, onboarding.
//
// All 390×844 (iPhone 14 viewport).

// ─────────────────────────────────────────────────────────────
// 01 · Agenda mobile — day view vertical timeline
// ─────────────────────────────────────────────────────────────
function MAgenda() {
  const days = [
    { k: 'lun', l: 'Lun', n: '21' },
    { k: 'mar', l: 'Mar', n: '22' },
    { k: 'mer', l: 'Mer', n: '23' },
    { k: 'jeu', l: 'Jeu', n: '24', on: true },
    { k: 'ven', l: 'Ven', n: '25' },
    { k: 'sam', l: 'Sam', n: '26' },
    { k: 'dim', l: 'Dim', n: '27' },
  ];
  const rdvs = [
    { t: '09:00', dur: '15 min', name: 'Laila Bouhlal',   reason: 'Contrôle tension',  status: 'done', allergy: null },
    { t: '09:30', dur: '30 min', name: 'Ahmed Cherkaoui', reason: 'Suivi HTA',         status: 'arrived', allergy: 'Aspirine' },
    { t: '10:30', dur: '30 min', name: 'Youness Alaoui',  reason: 'Bilan sanguin',     status: 'consult', allergy: null },
    { t: '11:15', dur: '15 min', name: 'Khadija Tahiri',  reason: 'Contrôle diabète',  status: 'confirmed' },
    { t: '14:00', dur: '20 min', name: 'Sanae Kettani',   reason: 'Suivi grossesse',   status: 'confirmed' },
    { t: '15:00', dur: '15 min', name: 'Driss Benkirane', reason: 'Renouvellement',    status: 'confirmed' },
  ];

  return (
    <MScreen
      tab="agenda"
      topbar={
        <MTopbar
          brand
          left={<MIconBtn icon="Menu" />}
          title={null}
          right={<>
            <MIconBtn icon="Search" />
            <MIconBtn icon="Bell" badge />
          </>}
        />
      }
      fab={
        <button className="m-fab" aria-label="Nouveau RDV" style={{border:0, cursor:'pointer'}}>
          <Icon.Plus />
        </button>
      }
    >
      {/* Day tabs */}
      <div className="m-daytabs">
        {days.map(d => (
          <div key={d.k} className={`m-daytab ${d.on ? 'on' : ''}`}>
            <div className="dl">{d.l}</div>
            <div className="dn">{d.n}</div>
          </div>
        ))}
      </div>

      <div className="mb-pad" style={{paddingTop: 14, paddingBottom: 24}}>
        <div className="m-section-h">
          <h3>Jeudi 24 avril · 6 rendez-vous</h3>
        </div>

        <div className="m-tl">
          {rdvs.map((r, i) => (
            <div key={i} className="m-tl-row">
              <div className="m-tl-hour">{r.t}</div>
              <div className="m-tl-col filled">
                <div className={`m-tl-block ${r.status}`}>
                  <div className="m-tl-block-h">
                    <span className="m-tl-block-time">{r.t} · {r.dur}</span>
                    <span className={`m-pill ${r.status}`} style={{marginLeft:'auto'}}>
                      {r.status === 'confirmed' ? 'Confirmé' : r.status === 'arrived' ? 'Arrivé' : r.status === 'consult' ? 'En consult.' : 'Terminé'}
                    </span>
                  </div>
                  <div className="m-tl-block-name">{r.name}</div>
                  <div className="m-tl-block-reason">{r.reason}</div>
                  {r.allergy && (
                    <div className="m-pill allergy" style={{marginTop: 8}}>
                      <Icon.Warn /> {r.allergy}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 02 · Prise de RDV — full screen form (not a modal on mobile)
// ─────────────────────────────────────────────────────────────
function MPriseRDV() {
  const slots = ['09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00'];
  return (
    <MScreen
      tab="agenda"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="Nouveau RDV"
          sub="Étape 2/3"
          right={<span style={{color:'var(--ink-3)', fontSize: 13, padding: '0 12px', fontWeight: 550}}>Annuler</span>}
        />
      }
    >
      <div className="mb-pad-lg">
        {/* Patient card (already selected) */}
        <div className="m-section-h"><h3>Patient</h3></div>
        <div className="m-card" style={{marginBottom: 18}}>
          <div className="m-row">
            <div className="cp-avatar" style={{width: 38, height: 38, fontSize: 13}}>FL</div>
            <div className="m-row-pri">
              <div className="m-row-main">Fatima Z. Lahlou</div>
              <div className="m-row-sub">Née le 14/03/1991 · CIN BK 472 193</div>
            </div>
            <span style={{color:'var(--primary)', fontSize: 13, fontWeight: 550}}>Changer</span>
          </div>
        </div>

        <div className="m-field">
          <label>Motif de consultation</label>
          <select className="m-input">
            <option>Suivi grossesse 24 SA</option>
            <option>Première consultation</option>
            <option>Consultation de suivi</option>
          </select>
        </div>

        <div className="m-field">
          <label>Durée</label>
          <div className="m-segmented">
            <button>15 min</button>
            <button className="on">20 min</button>
            <button>30 min</button>
            <button>45 min</button>
          </div>
        </div>

        <div className="m-section-h" style={{marginTop: 6}}><h3>Créneaux disponibles · Jeudi 24 avril</h3></div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18}}>
          {slots.map((s, i) => {
            const on = s === '10:30';
            return (
              <button key={s} style={{
                height: 42, borderRadius: 10,
                border: on ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: on ? 'var(--primary-soft)' : 'var(--surface)',
                color: on ? 'var(--primary)' : 'var(--ink)',
                fontWeight: on ? 600 : 500, fontSize: 14,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.005em',
                fontFamily: 'inherit', cursor: 'pointer',
              }}>{s}</button>
            );
          })}
        </div>

        <div className="m-field">
          <label>Note pour le médecin (optionnel)</label>
          <textarea className="m-input m-textarea" placeholder="Ex. Résultats du bilan disponibles"></textarea>
        </div>

        <button className="m-btn primary" style={{marginTop: 8}}>
          Confirmer le rendez-vous
          <Icon.ChevronRight />
        </button>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 03 · Dossier patient — header + tabs + timeline
// ─────────────────────────────────────────────────────────────
function MDossier() {
  const [tab, setTab] = React.useState('historique');
  return (
    <MScreen
      tab="patients"
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="Dossier patient"
          right={<MIconBtn icon="MoreH" />}
        />
      }
    >
      {/* Patient header */}
      <div className="m-phead">
        <div className="cp-avatar" style={{background: 'var(--primary)'}}>MA</div>
        <div style={{flex: 1, minWidth: 0}}>
          <div className="m-phead-name">Mohamed Alami</div>
          <div className="m-phead-meta">H · 58 ans · CIN BE 138 475</div>
        </div>
      </div>

      {/* Allergy strip */}
      <div style={{
        background: 'var(--amber-soft)', padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)', fontSize: 13, fontWeight: 600,
      }}>
        <Icon.Warn />
        <span>Allergie : Pénicilline</span>
      </div>

      <div className="mb-pad">
        {/* Primary CTA — start consultation (POST /consultations) */}
        <button className="m-btn primary" style={{height: 44, marginBottom: 16}}>
          <Icon.Stetho /> Démarrer consultation
        </button>

        {/* Quick action buttons */}
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16}}>
          {[
            { ico: 'Phone', lbl: 'Appeler' },
            { ico: 'Calendar', lbl: 'RDV' },
            { ico: 'Pill', lbl: 'Rx' },
            { ico: 'File', lbl: 'Notes' },
          ].map(a => {
            const Ico = Icon[a.ico];
            return (
              <button key={a.lbl} style={{
                background: 'var(--bg-alt)', border: 0, borderRadius: 10, padding: '10px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                color: 'var(--ink)', fontSize: 11, fontWeight: 550, cursor: 'pointer',
              }}>
                <Ico /><span>{a.lbl}</span>
              </button>
            );
          })}
        </div>

        {/* Key info card */}
        <div className="m-card" style={{marginBottom: 14}}>
          <div style={{padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)'}}>
            Antécédents
          </div>
          <div style={{padding: '10px 14px', fontSize: 13, lineHeight: 1.55}}>
            HTA (2018), Dyslipidémie
          </div>
          <div style={{padding: '10px 14px', borderTop: '1px solid var(--border-soft)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)'}}>
            Traitement chronique
          </div>
          <div style={{padding: '10px 14px', fontSize: 13, lineHeight: 1.6}}>
            · Amlodipine 5 mg — 1 cp matin<br/>
            · Atorvastatine 20 mg — 1 cp soir<br/>
            · Aspirine 100 mg — 1 cp midi
          </div>
        </div>

        <div className="m-segmented">
          <button className={tab === 'historique' ? 'on' : ''} onClick={() => setTab('historique')}>Historique</button>
          <button className={tab === 'analyses' ? 'on' : ''} onClick={() => setTab('analyses')}>Analyses</button>
          <button className={tab === 'admin' ? 'on' : ''} onClick={() => setTab('admin')}>Admin.</button>
        </div>

        {/* Timeline */}
        {[
          { date: '23 avr 2026', kind: 'Consultation', who: 'Dr. K. El Amrani', summary: 'TA 135/85 — Légère augmentation. Bilan lipidique demandé.' },
          { date: '25 mar 2026', kind: 'Analyse',      who: 'Labo Atlas',       summary: 'Cholestérol total 2.35 g/L, LDL 1.58 g/L, HDL 0.42 g/L' },
          { date: '18 mar 2026', kind: 'Consultation', who: 'Dr. K. El Amrani', summary: 'Examen cardiovasculaire normal.' },
        ].map((e, i) => (
          <div key={i} className="m-card" style={{marginBottom: 10}}>
            <div style={{padding: '12px 14px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
                <span style={{fontSize: 11, fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em'}}>{e.kind}</span>
                <span style={{fontSize: 11, color: 'var(--ink-4)'}}>•</span>
                <span style={{fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums'}}>{e.date}</span>
              </div>
              <div style={{fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)', marginBottom: 4}}>{e.summary}</div>
              <div style={{fontSize: 11, color: 'var(--ink-3)'}}>{e.who}</div>
            </div>
          </div>
        ))}
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 04 · Salle d'attente
// ─────────────────────────────────────────────────────────────
function MSalle() {
  const patients = [
    { name: 'Mohamed Alami',    apt: '09:00', since: '09:04', status: 'consult', allergy: 'Pénicilline', room: 'Box A' },
    { name: 'Youssef Ziani',    apt: '10:00', since: '09:51', status: 'vitals',  room: 'Box B' },
    { name: 'Ahmed Cherkaoui',  apt: '15:00', since: '—',     status: 'arrived', allergy: 'Aspirine', room: null },
    { name: 'Khadija Tahiri',   apt: '11:15', since: '—',     status: 'waiting', room: null },
  ];
  return (
    <MScreen
      tab="salle"
      badges={{salle: patients.length}}
      topbar={
        <MTopbar
          brand
          title={null}
          right={<>
            <MIconBtn icon="Search" />
            <MIconBtn icon="Bell" badge />
          </>}
        />
      }
    >
      <div className="mb-pad">
        <div style={{fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2}}>Salle d'attente</div>
        <div style={{fontSize: 13, color: 'var(--ink-3)', marginBottom: 14}}>Jeudi 24 avril · 10:24</div>

        <div className="m-stat-grid">
          <div className="m-stat">
            <div className="m-stat-k">À voir</div>
            <div className="m-stat-v">4</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">Attente moy.</div>
            <div className="m-stat-v">12<span className="m-stat-u">min</span></div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">En consult.</div>
            <div className="m-stat-v">1</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">Retard</div>
            <div className="m-stat-v" style={{color:'var(--amber)'}}>+7<span className="m-stat-u">min</span></div>
          </div>
        </div>

        <div className="m-section-h">
          <h3>File d'attente</h3>
          <span className="more">Trier</span>
        </div>

        <div className="m-card">
          {patients.length === 0 ? (
            <div style={{padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13}}>
              Aucun patient présent
            </div>
          ) : patients.map((p, i) => {
            const isDone     = p.status === 'done';
            const isConsult  = p.status === 'consult';
            const startable  = !isDone && !isConsult; // arrived / waiting / vitals
            return (
              <button
                key={i}
                className="m-row"
                disabled={isDone}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 0, borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                  fontFamily: 'inherit', font: 'inherit', cursor: isDone ? 'default' : 'pointer',
                  opacity: isDone ? 0.6 : 1,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
                  background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 13, fontWeight: 600,
                }}>
                  {p.name.split(' ').map(w => w[0]).slice(0,2).join('')}
                </div>
                <div className="m-row-pri">
                  <div className="m-row-main">{p.name}</div>
                  <div style={{display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap'}}>
                    <span className={`m-pill ${p.status}`}>
                      {isConsult ? 'En consult.' : p.status === 'vitals' ? 'Constantes' : p.status === 'arrived' ? 'Arrivé' : p.status === 'done' ? 'Terminé' : 'Confirmé'}
                    </span>
                    {p.room && <span style={{fontSize: 11, color: 'var(--ink-3)', fontWeight: 550}}>· {p.room}</span>}
                    {p.allergy && <span className="m-pill allergy" style={{fontSize: 10, padding: '2px 6px'}}><Icon.Warn /> {p.allergy}</span>}
                  </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <div style={{textAlign: 'right'}}>
                    <div className="m-row-time">{p.apt}</div>
                    <div style={{fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2}}>{p.since !== '—' ? `Depuis ${p.since}` : 'pas arrivé'}</div>
                  </div>
                  {!isDone && (
                    <span style={{
                      color: startable ? 'var(--primary)' : 'var(--ink-4)',
                      display: 'grid', placeItems: 'center',
                    }}>
                      {startable ? <Icon.Stetho /> : <Icon.ChevronRight />}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 05 · Prise des constantes (tablet feel on mobile)
// ─────────────────────────────────────────────────────────────
function MConstantes() {
  return (
    <MScreen
      tab="salle"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="Constantes"
          sub="Mohamed Alami"
        />
      }
    >
      <div className="mb-pad-lg">
        <div style={{
          background: 'var(--amber-soft)', padding: '10px 12px',
          borderRadius: 10, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber)', fontSize: 12.5, fontWeight: 600,
        }}>
          <Icon.Warn /><span>Allergie : Pénicilline</span>
        </div>

        <div className="m-section-h"><h3>Signes vitaux</h3></div>

        {[
          { icon: 'Heart',  k: 'Tension artérielle', v: '—', u: 'mmHg', ref: 'Ref. 120/80',    prev: 'Prec. 135/85' },
          { icon: 'Heart',  k: 'Fréquence cardiaque', v: '—', u: 'bpm',  ref: 'Ref. 60–100',    prev: 'Prec. 78' },
          { icon: 'Thermo', k: 'Température',         v: '—', u: '°C',   ref: 'Ref. 36,1–37,2', prev: null },
          { icon: 'Signal', k: 'Saturation O₂',       v: '—', u: '%',    ref: 'Ref. ≥ 95',      prev: null },
        ].map((f, i) => {
          const Ico = Icon[f.icon];
          return (
            <div key={i} className="m-card" style={{marginBottom: 10}}>
              <div style={{padding: '14px 14px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-soft)'}}>
                <span style={{color:'var(--primary)'}}><Ico /></span>
                <span style={{fontSize: 13, fontWeight: 600, flex: 1}}>{f.k}</span>
                <span style={{fontSize: 11, color:'var(--ink-3)'}}>{f.ref}</span>
              </div>
              <div style={{padding: '14px', display: 'flex', alignItems: 'baseline', gap: 6}}>
                <input
                  className="m-input"
                  placeholder={f.v}
                  style={{flex: 1, height: 54, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums'}}
                />
                <span style={{fontSize: 15, color: 'var(--ink-3)', fontWeight: 550}}>{f.u}</span>
              </div>
              {f.prev && (
                <div style={{padding: '0 14px 12px', fontSize: 11, color: 'var(--ink-3)'}}>
                  {f.prev}
                </div>
              )}
            </div>
          );
        })}

        <div className="m-field" style={{marginTop: 12}}>
          <label>Poids · Taille · IMC</label>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8}}>
            <input className="m-input" placeholder="Poids"/>
            <input className="m-input" placeholder="Taille"/>
            <input className="m-input" placeholder="IMC" disabled style={{background: 'var(--bg-alt)'}}/>
          </div>
        </div>

        <button className="m-btn primary" style={{marginTop: 16}}>
          Enregistrer et passer la main
        </button>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 06 · Consultation SOAP — mobile accordion
// ─────────────────────────────────────────────────────────────
function MConsultation() {
  return (
    <MScreen
      tab="agenda"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="Consultation"
          sub="Mohamed Alami · 09:12"
          right={<MIconBtn icon="MoreH" />}
        />
      }
    >
      {/* Patient context strip */}
      <div style={{
        background: 'var(--primary-soft)', padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)',
      }}>
        <div style={{width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600}}>MA</div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 13, fontWeight: 600}}>Mohamed Alami</div>
          <div style={{fontSize: 11, color:'var(--ink-3)'}}>H · 58 ans · HTA · TA 135/85</div>
        </div>
        <span className="m-pill allergy"><Icon.Warn /> Pénicilline</span>
      </div>

      <div className="mb-pad">
        {/* Vitals recap */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14}}>
          {[['TA', '135/85'], ['FC', '82'], ['T°', '36,8'], ['SpO₂', '98']].map(([k,v]) => (
            <div key={k} style={{background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 4px', textAlign: 'center'}}>
              <div style={{fontSize: 9.5, fontWeight: 600, color:'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em'}}>{k}</div>
              <div style={{fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 1}}>{v}</div>
            </div>
          ))}
        </div>

        {/* SOAP accordion */}
        {[
          { l: 'S', t: 'Subjectif', v: 'Patient rapporte des céphalées matinales depuis 3 semaines. Stress professionnel, sommeil perturbé. Pas de dyspnée ni douleur thoracique.', open: true },
          { l: 'O', t: 'Objectif',  v: 'TA 135/85 à 2 reprises. Auscultation cardiaque normale, rythme régulier. Poids stable (78 kg).', open: true },
          { l: 'A', t: 'Analyse',   v: 'Tension mal contrôlée sous Amlodipine 5 mg. Dyslipidémie suivie, résultats en attente.', open: true },
          { l: 'P', t: 'Plan',      v: 'Ajustement Amlodipine 5 → 10 mg. Bilan lipidique de contrôle à 8 semaines. ECG de repos.', open: true },
        ].map((s, i) => (
          <div key={s.l} className="m-card" style={{marginBottom: 10}}>
            <div style={{padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: s.open ? '1px solid var(--border-soft)' : 'none'}}>
              <span style={{
                width: 26, height: 26, background: 'var(--primary)', color: 'white', borderRadius: 5,
                display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
              }}>{s.l}</span>
              <span style={{fontSize: 14, fontWeight: 600, flex: 1}}>{s.t}</span>
              <Icon.ChevronDown />
            </div>
            {s.open && (
              <div style={{padding: '12px 14px', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)'}}>
                {s.v}
              </div>
            )}
          </div>
        ))}

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14}}>
          <button className="m-btn" style={{height: 44}}><Icon.Pill /> Rx</button>
          <button className="m-btn primary" style={{height: 44}}>Clôturer</button>
        </div>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 07 · Prescription — list + add
// ─────────────────────────────────────────────────────────────
function MPrescription() {
  const items = [
    { name: 'Amlodipine 5 mg', pos: '1 cp le matin', dur: '30 jours' },
    { name: 'Atorvastatine 20 mg', pos: '1 cp le soir', dur: '30 jours' },
    { name: 'Aspirine 100 mg', pos: '1 cp le midi', dur: '30 jours', warn: 'Allergie Aspirine relevée' },
  ];
  return (
    <MScreen
      tab="agenda"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="Prescription"
          sub="Mohamed Alami"
        />
      }
    >
      <div className="mb-pad">
        <div className="m-search">
          <Icon.Search />
          <span>Ajouter un médicament…</span>
        </div>

        <div className="m-section-h">
          <h3>3 médicaments</h3>
          <span className="more">Modèles</span>
        </div>

        {items.map((it, i) => (
          <div key={i} className="m-card" style={{marginBottom: 10, borderLeft: it.warn ? '3px solid var(--amber)' : undefined}}>
            <div style={{padding: 14}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6}}>
                <span style={{color:'var(--primary)'}}><Icon.Pill /></span>
                <span style={{fontSize: 14, fontWeight: 600, flex: 1, letterSpacing:'-0.005em'}}>{it.name}</span>
                <button className="mt-icon" style={{border:0,background:'transparent',cursor:'pointer'}}><Icon.Edit /></button>
              </div>
              <div style={{fontSize: 13, color: 'var(--ink-2)', marginBottom: 2}}>{it.pos} · <span style={{color:'var(--ink-3)'}}>{it.dur}</span></div>
              {it.warn && (
                <div className="m-pill allergy" style={{marginTop: 8}}><Icon.Warn /> {it.warn}</div>
              )}
            </div>
          </div>
        ))}

        <button className="m-btn secondary" style={{marginTop: 8}}>
          <Icon.Plus /> Ajouter une ligne
        </button>

        <div style={{marginTop: 20, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5}}>
          <strong style={{color:'var(--ink-2)'}}>Durée globale :</strong> 30 jours
          <br/>
          <strong style={{color:'var(--ink-2)'}}>À renouveler :</strong> le 23/05/2026
        </div>

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14}}>
          <button className="m-btn"><Icon.Print /> Aperçu</button>
          <button className="m-btn primary">Signer & imprimer</button>
        </div>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 08 · Aperçu ordonnance — A4 zoomed out
// ─────────────────────────────────────────────────────────────
function MApercuOrdo() {
  return (
    <MScreen
      tab="agenda"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="Aperçu ordonnance"
          right={<MIconBtn icon="Print" />}
        />
      }
    >
      <div style={{padding: 16, background: 'var(--bg)'}}>
        <div className="m-a4-preview" style={{padding: '22px 22px', fontSize: 10}}>
          <div style={{display: 'flex', borderBottom: '1.5px solid var(--primary)', paddingBottom: 10, marginBottom: 14}}>
            <div style={{flex: 1}}>
              <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 16, color:'var(--primary)', lineHeight: 1}}>Dr. Karim El Amrani</div>
              <div style={{fontSize: 9, color: '#444', marginTop: 4, lineHeight: 1.4}}>
                Médecin généraliste · INPE 12345<br/>
                45 Bd d'Anfa · Casablanca 20100<br/>
                +212 522 33 44 55
              </div>
            </div>
            <div style={{textAlign: 'right', fontSize: 8.5, color: '#555'}}>
              Casablanca, le<br/>
              <strong style={{fontSize: 10, color:'#111'}}>24 avril 2026</strong>
            </div>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 14}}>
            <div>
              <strong style={{color:'#111'}}>Mohamed Alami</strong><br/>
              H · 58 ans · CIN BE 138 475
            </div>
          </div>

          <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 20, fontStyle: 'italic', color:'var(--primary)', marginBottom: 10}}>
            Ordonnance
          </div>

          <div style={{fontSize: 10, lineHeight: 1.8}}>
            <div style={{marginBottom: 10, paddingLeft: 10, borderLeft: '2px solid var(--primary)'}}>
              <div style={{fontWeight: 600}}>1. Amlodipine 5 mg</div>
              <div>1 comprimé le matin · 30 jours</div>
            </div>
            <div style={{marginBottom: 10, paddingLeft: 10, borderLeft: '2px solid var(--primary)'}}>
              <div style={{fontWeight: 600}}>2. Atorvastatine 20 mg</div>
              <div>1 comprimé le soir · 30 jours</div>
            </div>
            <div style={{marginBottom: 10, paddingLeft: 10, borderLeft: '2px solid var(--primary)'}}>
              <div style={{fontWeight: 600}}>3. Aspirine 100 mg</div>
              <div>1 comprimé au déjeuner · 30 jours</div>
            </div>
          </div>

          <div style={{marginTop: 20, textAlign: 'right', fontSize: 9}}>
            <div style={{fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 14, color: 'var(--primary)', marginTop: 22}}>Dr. K. El Amrani</div>
            <div style={{borderTop: '1px solid #111', width: 140, marginLeft: 'auto', marginTop: 4}}/>
          </div>
        </div>
      </div>

      <div style={{padding: '10px 16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
        <button className="m-btn"><Icon.File /> Envoyer</button>
        <button className="m-btn primary"><Icon.Print /> Imprimer</button>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 09 · Facturation
// ─────────────────────────────────────────────────────────────
function MFacturation() {
  const invoices = [
    { n: 'FAC-2026-00482', name: 'Mohamed Alami',    amt: '300', status: 'paid',    date: '24/04' },
    { n: 'FAC-2026-00481', name: 'Fatima Z. Lahlou', amt: '250', status: 'pending', date: '24/04' },
    { n: 'FAC-2026-00480', name: 'Youssef Ziani',    amt: '450', status: 'paid',    date: '23/04' },
    { n: 'FAC-2026-00479', name: 'Khadija Tahiri',   amt: '300', status: 'overdue', date: '19/04' },
    { n: 'FAC-2026-00478', name: 'Ahmed Cherkaoui',  amt: '300', status: 'paid',    date: '19/04' },
  ];
  return (
    <MScreen
      tab="factu"
      topbar={
        <MTopbar
          brand
          title={null}
          right={<>
            <MIconBtn icon="Filter" />
            <MIconBtn icon="Bell" />
          </>}
        />
      }
      fab={
        <button className="m-fab" aria-label="Nouvelle facture" style={{border:0, cursor:'pointer'}}>
          <Icon.Plus />
        </button>
      }
    >
      <div className="mb-pad">
        <div style={{fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14}}>Facturation</div>

        <div className="m-stat-grid">
          <div className="m-stat">
            <div className="m-stat-k">Avril · encaissé</div>
            <div className="m-stat-v">42 750<span className="m-stat-u">MAD</span></div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">En attente</div>
            <div className="m-stat-v" style={{color:'var(--amber)'}}>3 200<span className="m-stat-u">MAD</span></div>
          </div>
        </div>

        <div className="m-segmented">
          <button className="on">Toutes</button>
          <button>En attente</button>
          <button>Retard</button>
        </div>

        <div className="m-card">
          {invoices.map((f, i) => (
            <div key={i} className="m-row">
              <div className="m-row-pri">
                <div className="m-row-main">{f.name}</div>
                <div style={{display: 'flex', gap: 6, alignItems: 'center', marginTop: 4}}>
                  <span className="mono" style={{fontSize: 11, color:'var(--ink-3)', letterSpacing: 0}}>{f.n}</span>
                  <span style={{fontSize: 11, color: 'var(--ink-4)'}}>·</span>
                  <span style={{fontSize: 11, color:'var(--ink-3)', fontVariantNumeric: 'tabular-nums'}}>{f.date}</span>
                </div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.005em'}}>
                  {f.amt} <span style={{fontSize: 11, color: 'var(--ink-3)', fontWeight: 500}}>MAD</span>
                </div>
                <div style={{marginTop: 3}}>
                  {f.status === 'paid'    && <span className="m-pill" style={{background: 'var(--success-soft)', color: 'var(--success)'}}>Payée</span>}
                  {f.status === 'pending' && <span className="m-pill waiting">En attente</span>}
                  {f.status === 'overdue' && <span className="m-pill" style={{background: 'var(--danger-soft)', color: 'var(--danger)'}}>Retard</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 10 · Aperçu facture
// ─────────────────────────────────────────────────────────────
function MApercuFacture() {
  return (
    <MScreen
      tab="factu"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" />}
          title="FAC-2026-00482"
          right={<MIconBtn icon="MoreH" />}
        />
      }
    >
      <div style={{padding: 16, background: 'var(--bg)'}}>
        <div className="m-a4-preview" style={{padding: '22px 22px', fontSize: 10}}>
          <div style={{display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1.5px solid var(--primary)', marginBottom: 12}}>
            <div>
              <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 14, color:'var(--primary)', lineHeight: 1}}>Cabinet Médical El Amrani</div>
              <div style={{fontSize: 8.5, color:'#555', marginTop: 4, lineHeight: 1.4}}>
                45 Bd d'Anfa, Casablanca<br/>
                ICE 001234567000089
              </div>
            </div>
          </div>

          <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 18, fontStyle: 'italic', color:'var(--primary)', letterSpacing:'-0.01em', marginBottom: 14}}>
            Facture
          </div>

          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 14}}>
            <div>
              <div style={{color:'#777', textTransform: 'uppercase', fontSize: 7.5, letterSpacing: '0.1em', marginBottom: 2}}>Facturé à</div>
              <strong style={{fontSize: 10.5}}>Mohamed Alami</strong><br/>
              45 Rue Atlas, Casablanca
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{color:'#777', textTransform: 'uppercase', fontSize: 7.5, letterSpacing: '0.1em', marginBottom: 2}}>N° facture</div>
              <strong style={{fontSize: 10.5}}>FAC-2026-00482</strong><br/>
              <span style={{fontSize: 8.5, color:'#555'}}>24 avril 2026</span>
            </div>
          </div>

          <div style={{borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: '8px 0', marginBottom: 10, fontSize: 9.5}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 4}}>
              <span>Consultation généraliste</span>
              <span style={{fontVariantNumeric: 'tabular-nums'}}>300,00</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', color:'#666'}}>
              <span>Ticket modérateur</span>
              <span style={{fontVariantNumeric: 'tabular-nums'}}>– 50,00</span>
            </div>
          </div>

          <div style={{display:'flex', justifyContent:'space-between', padding: '8px 10px', background: 'var(--primary)', color: 'white', borderRadius: 3, fontWeight: 600, fontSize: 11}}>
            <span>Total TTC</span>
            <span style={{fontVariantNumeric: 'tabular-nums'}}>250,00 MAD</span>
          </div>

          <div style={{marginTop: 14, fontSize: 8, color:'#666', lineHeight: 1.5}}>
            Mentions légales loi 9-88 · Exonéré de TVA (art. 91)
          </div>
        </div>
      </div>

      <div style={{padding: '10px 16px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
        <button className="m-btn"><Icon.File /> Envoyer</button>
        <button className="m-btn primary"><Icon.Check /> Marquer payée</button>
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 11 · Paramétrage
// ─────────────────────────────────────────────────────────────
function MParametrage() {
  const sections = [
    {
      h: 'Cabinet',
      items: [
        { ico: 'File',     k: 'Informations',     v: 'Cabinet Médical El Amrani' },
        { ico: 'Doc',      k: 'Identifiants fisc.', v: 'ICE · RC · Patente · IF · CNSS' },
        { ico: 'Print',    k: 'Mise en page documents', v: 'En-tête, logo, mentions' },
      ],
    },
    {
      h: 'Équipe',
      items: [
        { ico: 'Users',    k: 'Utilisateurs',     v: '3 actifs' },
        { ico: 'Lock',     k: 'Rôles et permissions', v: null },
      ],
    },
    {
      h: 'Pratique',
      items: [
        { ico: 'Clock',    k: 'Horaires d\'ouverture', v: 'Lun – Sam · 8h30 – 19h' },
        { ico: 'Pill',     k: 'Modèles d\'ordonnance', v: '14 modèles' },
        { ico: 'Invoice',  k: 'Actes et tarifs',  v: '8 actes' },
      ],
    },
    {
      h: 'Compte',
      items: [
        { ico: 'Lock',     k: 'Sécurité',          v: '2FA activé' },
        { ico: 'Logout',   k: 'Déconnexion',       v: null, danger: true },
      ],
    },
  ];
  return (
    <MScreen
      tab="menu"
      topbar={
        <MTopbar
          title="Paramètres"
        />
      }
    >
      {/* Profile */}
      <div className="m-phead">
        <div className="cp-avatar" style={{background: 'var(--primary)'}}>KE</div>
        <div style={{flex: 1, minWidth: 0}}>
          <div className="m-phead-name">Dr. Karim El Amrani</div>
          <div className="m-phead-meta">Médecin généraliste · INPE 12345</div>
        </div>
        <Icon.ChevronRight />
      </div>

      <div className="mb-pad">
        {sections.map((sec, si) => (
          <div key={si} style={{marginBottom: 18}}>
            <div className="m-section-h"><h3>{sec.h}</h3></div>
            <div className="m-card">
              {sec.items.map((it, i) => {
                const Ico = Icon[it.ico];
                return (
                  <div key={i} className="m-row">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: it.danger ? 'var(--danger-soft)' : 'var(--primary-soft)',
                      color: it.danger ? 'var(--danger)' : 'var(--primary)',
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Ico />
                    </div>
                    <div className="m-row-pri">
                      <div className="m-row-main" style={{color: it.danger ? 'var(--danger)' : undefined}}>{it.k}</div>
                      {it.v && <div className="m-row-sub">{it.v}</div>}
                    </div>
                    {!it.danger && <span className="m-row-chev"><Icon.ChevronRight /></span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </MScreen>
  );
}

// ─────────────────────────────────────────────────────────────
// 12 · Login
// ─────────────────────────────────────────────────────────────
function MLogin() {
  return (
    <div className="cp-mobile cp-app" style={{background: 'var(--surface)'}}>
      <div style={{
        background: 'linear-gradient(155deg, #1E5AA8 0%, #174585 55%, #112F5C 100%)',
        padding: '48px 26px 40px', color: 'white', position: 'relative',
        borderRadius: '0 0 22px 22px',
      }}>
        <div style={{display:'flex', alignItems:'center', gap: 10, marginBottom: 36}}>
          <div style={{
            width: 32, height: 32, background: 'white', color: 'var(--primary)',
            borderRadius: 8, display: 'grid', placeItems: 'center',
            fontSize: 17, fontWeight: 700, letterSpacing:'-0.03em',
          }}>c</div>
          <span style={{fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em'}}>careplus</span>
        </div>
        <div style={{fontSize: 30, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.025em'}}>
          Bon retour,<br/>
          <span style={{color: '#A8C5E8', fontWeight: 500}}>docteur.</span>
        </div>
        <div style={{fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 10, lineHeight: 1.5}}>
          Connectez-vous à votre cabinet
        </div>
      </div>

      <div style={{padding: '28px 22px', flex: 1, overflowY: 'auto'}}>
        <div className="m-field">
          <label>Adresse e-mail</label>
          <input className="m-input" placeholder="dr.alami@cabinet.ma" defaultValue="k.elamrani@cabinet-elamrani.ma"/>
        </div>
        <div className="m-field">
          <label>Mot de passe</label>
          <input className="m-input" type="password" defaultValue="••••••••••"/>
        </div>
        <div style={{display:'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, fontSize: 12}}>
          <label style={{display:'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)'}}>
            <input type="checkbox" defaultChecked /> Garder ma session
          </label>
          <a style={{color: 'var(--primary)', fontWeight: 600}}>Mot de passe oublié ?</a>
        </div>
        <button className="m-btn primary" style={{height: 52, fontSize: 15}}>
          <Icon.Lock /> Se connecter
        </button>

        <div style={{marginTop: 22, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', fontSize: 12, display: 'flex', gap: 10, alignItems:'start'}}>
          <span style={{color: 'var(--primary)', flexShrink: 0, paddingTop: 1}}><Icon.Lock /></span>
          <div>
            <div style={{fontWeight: 600, marginBottom: 2}}>Connexion sécurisée</div>
            <div style={{color: 'var(--ink-3)', fontSize: 11.5, lineHeight: 1.4}}>
              Chiffrement TLS · données hébergées au Maroc · conforme loi 09-08
            </div>
          </div>
        </div>

        <div style={{textAlign: 'center', fontSize: 12, color: 'var(--ink-3)', marginTop: 20}}>
          Pas encore de compte ? <a style={{color: 'var(--primary)', fontWeight: 600}}>Démarrer un essai</a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 13 · Onboarding wizard
// ─────────────────────────────────────────────────────────────
function MOnboarding() {
  return (
    <div className="cp-mobile cp-app">
      <div className="mt">
        <MIconBtn icon="ChevronLeft" />
        <div style={{flex: 1, textAlign: 'center'}}>
          <div style={{fontSize: 11, color: 'var(--ink-3)', fontWeight: 550, letterSpacing: '0.05em'}}>ÉTAPE 3 / 7</div>
          <div style={{
            width: '100%', height: 3, background: 'var(--border-soft)', borderRadius: 2,
            marginTop: 6, overflow: 'hidden',
          }}>
            <div style={{width: '43%', height: '100%', background: 'var(--primary)'}}/>
          </div>
        </div>
        <span style={{width: 36}}/>
      </div>

      <div className="mb" style={{padding: '24px 22px'}}>
        <div style={{fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 10}}>
          Quand recevez-vous vos patients&nbsp;?
        </div>
        <div style={{fontSize: 14, color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.5}}>
          Ces créneaux alimentent votre agenda et la prise de RDV par votre secrétaire.
        </div>

        <div className="m-section-h"><h3>Horaires</h3></div>
        {[
          { d: 'Lundi',    h: '8:30 – 12:30 · 14:30 – 19:00', on: true },
          { d: 'Mardi',    h: '8:30 – 12:30 · 14:30 – 19:00', on: true },
          { d: 'Mercredi', h: '8:30 – 12:30 · 14:30 – 19:00', on: true },
          { d: 'Jeudi',    h: '8:30 – 12:30 · 14:30 – 19:00', on: true },
          { d: 'Vendredi', h: '8:30 – 12:30',                 on: true },
          { d: 'Samedi',   h: '9:00 – 13:00',                 on: true },
          { d: 'Dimanche', h: 'Fermé',                         on: false },
        ].map((d, i) => (
          <div key={i} className="m-card" style={{marginBottom: 8}}>
            <div className="m-row">
              <div className="m-row-pri">
                <div className="m-row-main">{d.d}</div>
                <div className="m-row-sub">{d.h}</div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13,
                background: d.on ? 'var(--primary)' : 'var(--border-strong)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: d.on ? 20 : 2,
                  width: 22, height: 22, borderRadius: '50%', background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }}/>
              </div>
            </div>
          </div>
        ))}

        <div style={{marginTop: 16, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, padding: '10px 12px', background: 'var(--primary-soft)', borderRadius: 10}}>
          Vous pourrez modifier ces horaires à tout moment depuis les paramètres.
        </div>
      </div>

      <div style={{
        padding: '12px 16px 24px', background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10,
      }}>
        <button className="m-btn">Passer</button>
        <button className="m-btn primary">Continuer <Icon.ChevronRight /></button>
      </div>
    </div>
  );
}

Object.assign(window, {
  MAgenda, MPriseRDV, MDossier, MSalle, MConstantes, MConsultation,
  MPrescription, MApercuOrdo, MFacturation, MApercuFacture,
  MParametrage, MLogin, MOnboarding,
});
