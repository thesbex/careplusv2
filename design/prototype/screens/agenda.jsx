// Screen 1 — Agenda semaine (weekly calendar, secretary view)

const WEEK_DAYS = [
  { key: 'lun', label: 'Lundi',    date: '21' },
  { key: 'mar', label: 'Mardi',    date: '22' },
  { key: 'mer', label: 'Mercredi', date: '23' },
  { key: 'jeu', label: 'Jeudi',    date: '24' },
  { key: 'ven', label: 'Vendredi', date: '25' },
  { key: 'sam', label: 'Samedi',   date: '26' },
];

const HOURS = Array.from({length: 12}, (_, i) => 8 + i); // 8..19

// Real appointments (verbatim)
const APPOINTMENTS = [
  { day: 'lun', start: '09:00', dur: 15, patient: 'Mohamed Alami',         reason: 'Consultation de suivi',     allergy: 'Pénicilline', status: 'consult' },
  { day: 'lun', start: '09:30', dur: 20, patient: 'Fatima Zahra Lahlou',   reason: 'Suivi grossesse 24 SA',     status: 'confirmed' },
  { day: 'lun', start: '10:00', dur: 30, patient: 'Youssef Ziani',         reason: 'Première consultation',     status: 'vitals' },
  { day: 'mar', start: '11:15', dur: 15, patient: 'Khadija Tahiri',        reason: 'Contrôle diabète',          status: 'confirmed' },
  { day: 'mer', start: '15:00', dur: 15, patient: 'Ahmed Cherkaoui',       reason: 'Suivi HTA',                 allergy: 'Aspirine', status: 'arrived' },
  // filler to convey a working week
  { day: 'lun', start: '11:00', dur: 20, patient: 'Samira Bennani',        reason: 'Renouvellement ord.',       status: 'done' },
  { day: 'lun', start: '14:30', dur: 30, patient: 'Omar Idrissi',          reason: 'Bilan annuel',              status: 'confirmed' },
  { day: 'lun', start: '16:00', dur: 15, patient: 'Nadia Fassi',           reason: 'Résultats analyses',        status: 'confirmed' },
  { day: 'mar', start: '09:15', dur: 20, patient: 'Karim Berrada',         reason: 'Douleurs lombaires',        status: 'confirmed' },
  { day: 'mar', start: '10:00', dur: 15, patient: 'Leila Chraibi',         reason: 'Vaccination',               status: 'confirmed' },
  { day: 'mar', start: '14:00', dur: 30, patient: 'Rachid Mansouri',       reason: 'Première consultation',     status: 'confirmed' },
  { day: 'mar', start: '15:30', dur: 15, patient: 'Amina Touhami',         reason: 'Certificat médical',        status: 'confirmed' },
  { day: 'mer', start: '08:30', dur: 30, patient: 'Hassan El Fassi',       reason: 'Consultation',              status: 'confirmed' },
  { day: 'mer', start: '11:00', dur: 20, patient: 'Zineb Ouazzani',        reason: 'Suivi thyroïde',            status: 'confirmed' },
  { day: 'mer', start: '16:00', dur: 30, patient: 'Brahim Sqalli',         reason: 'Première consultation',     status: 'confirmed' },
  { day: 'jeu', start: '09:00', dur: 15, patient: 'Laila Bouhlal',         reason: 'Contrôle tension',          status: 'confirmed' },
  { day: 'jeu', start: '10:30', dur: 30, patient: 'Youness Alaoui',        reason: 'Bilan sanguin',             status: 'confirmed' },
  { day: 'jeu', start: '14:00', dur: 20, patient: 'Sanae Kettani',         reason: 'Suivi grossesse 32 SA',     status: 'confirmed' },
  { day: 'jeu', start: '15:00', dur: 15, patient: 'Driss Benkirane',       reason: 'Renouvellement',            status: 'confirmed' },
  { day: 'ven', start: '08:30', dur: 20, patient: 'Meriem Tazi',           reason: 'Migraines',                 status: 'confirmed' },
  { day: 'ven', start: '10:00', dur: 15, patient: 'Abdellah Rami',         reason: 'Contrôle',                  status: 'confirmed' },
  { day: 'ven', start: '11:00', dur: 30, patient: 'Houda Benslimane',      reason: 'Première consultation',     status: 'confirmed' },
  { day: 'ven', start: '15:30', dur: 15, patient: 'Saad Cherradi',         reason: 'Résultats imagerie',        status: 'confirmed' },
  { day: 'sam', start: '09:00', dur: 30, patient: 'Aicha Semlali',         reason: 'Bilan annuel',              status: 'confirmed' },
  { day: 'sam', start: '10:30', dur: 15, patient: 'Walid Kadiri',          reason: 'Vaccination',               status: 'confirmed' },
];

const ARRIVALS = [
  { name: 'Mohamed Alami',   apt: '09:00', status: 'consult', since: '09:04', allergy: 'Pénicilline' },
  { name: 'Youssef Ziani',   apt: '10:00', status: 'vitals',  since: '09:51' },
  { name: 'Ahmed Cherkaoui', apt: '15:00', status: 'arrived', since: '—',     allergy: 'Aspirine' },
];

// hh:mm → minutes from 08:00
const toMin = (t) => { const [h,m] = t.split(':').map(Number); return (h - 8) * 60 + m; };
const ROW_PX = 72; // px per hour
const pxFromMin = (m) => (m / 60) * ROW_PX;

function AgendaBlock({ a, onClick }) {
  const top = pxFromMin(toMin(a.start)) + 2;
  const h = pxFromMin(a.dur) - 4;
  const compact = a.dur <= 15;
  const cls = `ag-block ag-${a.status}${compact ? ' ag-compact' : ''}`;
  return (
    <div className={cls} style={{ top, height: h }} onClick={() => onClick && onClick(a)}>
      {compact ? (
        <>
          <div className="ag-time tnum">{a.start}</div>
          <div className="ag-name">{a.patient}</div>
          {a.allergy && (
            <span className="ag-allergy-dot" title={`Allergie: ${a.allergy}`}><Icon.Warn /></span>
          )}
        </>
      ) : (
        <>
          <div className="ag-time tnum">{a.start} · {a.dur}min</div>
          <div className="ag-name">{a.patient}</div>
          <div className="ag-reason">{a.reason}</div>
          {a.allergy && (
            <div className="ag-allergy" title={`Allergie: ${a.allergy}`}>
              <Icon.Warn /> <span>{a.allergy}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AgendaSemaine() {
  const [selected, setSelected] = React.useState(null);

  return (
    <Screen
      active="agenda"
      title="Agenda"
      sub="Semaine 17 · Avr 2026"
      pageDate="Jeudi 23 avril 2026 · 09:47"
      topbarRight={(
        <>
          <button className="btn"><Icon.Phone /> Appel rapide</button>
          <button className="btn primary"><Icon.Plus /> Nouveau RDV</button>
        </>
      )}
      right={<TodayArrivals />}
    >
      <AgendaToolbar />
      <AgendaGrid onSelect={setSelected} />
      <style>{`
        .ag-toolbar { display:flex; align-items:center; gap:10px; padding: 10px 16px; border-bottom:1px solid var(--border); background: var(--surface); }
        .ag-week-nav { display:flex; align-items:center; border:1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
        .ag-week-nav button { width:30px; height:30px; display:grid; place-items:center; background:var(--surface); border:none; cursor:pointer; color: var(--ink-2); }
        .ag-week-nav button:hover { background: var(--bg); }
        .ag-week-nav .vdv { width: 1px; background: var(--border); align-self: stretch; }
        .ag-view-toggle { display:flex; border:1px solid var(--border); border-radius: var(--r-md); padding:2px; gap:2px; background: var(--bg); }
        .ag-view-toggle button { height:26px; padding:0 12px; border:none; background:transparent; font-size:11.5px; border-radius:4px; cursor:pointer; color:var(--ink-3); font-weight: 500; }
        .ag-view-toggle button.on { background: var(--surface); color:var(--ink); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
        .ag-legend { display:flex; gap:10px; margin-left:auto; font-size: 11px; color: var(--ink-3); align-items:center; }
        .ag-legend span { display:inline-flex; align-items:center; gap:5px; }
        .ag-legend i { width:8px; height:8px; border-radius:2px; display:inline-block; }

        .ag-grid-wrap { flex:1; display:flex; flex-direction:column; overflow: hidden; background: var(--surface); }
        .ag-header { display: grid; grid-template-columns: 56px repeat(6, 1fr); border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top:0; z-index: 3; }
        .ag-header-cell { padding: 10px 12px; font-size: 11.5px; color: var(--ink-3); border-left: 1px solid var(--border); display:flex; align-items:baseline; gap:8px; }
        .ag-header-cell:first-child { border-left: 0; }
        .ag-header-cell .d-lbl { font-weight: 500; color: var(--ink-3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
        .ag-header-cell .d-num { font-family: var(--font-sans); font-weight: 600; font-size: 15px; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
        .ag-header-cell.today { background: linear-gradient(180deg, var(--primary-soft), transparent 70%); }
        .ag-header-cell.today .d-num { color: var(--primary); }

        .ag-scroll { flex:1; overflow-y: auto; overflow-x: hidden; background: var(--surface); }
        .ag-grid { display: grid; grid-template-columns: 56px repeat(6, 1fr); position: relative; min-height: 100%; }
        .ag-hourcol { border-right: 1px solid var(--border); }
        .ag-hour-label { height: ${ROW_PX}px; text-align: right; padding: 4px 8px 0 0; font-size: 10.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; font-weight: 500; }
        .ag-daycol { border-left: 1px solid var(--border); position: relative; }
        .ag-hour-cell { height: ${ROW_PX}px; border-bottom: 1px solid var(--border); }
        .ag-hour-cell.half { border-bottom: 1px dashed #E2DCD0; }
        .ag-daycol.today { background: linear-gradient(180deg, rgba(30,90,168,0.03), transparent 200px); }
        .ag-now { position:absolute; left:0; right:0; height:0; border-top:1.5px solid var(--primary); z-index:2; pointer-events:none; }
        .ag-now::before { content:''; position:absolute; left:-4px; top:-4px; width:7px; height:7px; border-radius:50%; background: var(--primary); }
        .ag-now-lbl { position:absolute; left:-48px; top:-8px; font-size: 10px; color: var(--primary); background: var(--surface); padding: 0 4px; font-weight: 600; font-variant-numeric: tabular-nums; }

        .ag-block { position: absolute; left: 4px; right: 4px; border-radius: 5px; padding: 5px 7px; font-size: 11px; cursor: pointer; border-left: 3px solid; overflow: hidden; background: var(--surface); border-top:1px solid var(--border); border-right:1px solid var(--border); border-bottom:1px solid var(--border); }
        .ag-block.ag-compact { padding: 4px 7px; display:flex; align-items:center; gap:8px; }
        .ag-block.ag-compact .ag-time { flex:0 0 auto; }
        .ag-block.ag-compact .ag-name { flex:1 1 auto; margin-top: 0; font-size: 11px; }
        .ag-block.ag-compact .ag-allergy-dot { flex:0 0 auto; color: var(--amber); display:inline-flex; }
        .ag-block.ag-compact .ag-allergy-dot svg { width: 12px; height: 12px; }
        .ag-block:hover { filter: brightness(0.98); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
        .ag-block .ag-time { font-size: 10.5px; color: var(--ink-2); font-weight: 600; line-height: 1.2; letter-spacing: 0.01em; }
        .ag-consult .ag-time, .ag-arrived .ag-time { color: var(--primary-hover); }
        .ag-vitals .ag-time { color: var(--amber); }
        .ag-block .ag-name { font-weight: 600; color: var(--ink); line-height: 1.25; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ag-block .ag-reason { color: var(--ink-3); line-height: 1.25; margin-top: 1px; font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ag-block .ag-allergy { display:inline-flex; align-items:center; gap:3px; background: var(--amber-soft); color: var(--amber); padding: 1px 5px; border-radius: 3px; font-size: 9.5px; margin-top: 3px; font-weight: 600; }
        .ag-block .ag-allergy svg { width: 10px; height: 10px; }
        .ag-confirmed { border-left-color: var(--primary); background: #F4F7FC; }
        .ag-arrived   { border-left-color: #174585; background: #E4EDF8; }
        .ag-vitals    { border-left-color: var(--amber); background: #FBEFE3; }
        .ag-consult   { border-left-color: var(--primary); background: var(--primary-soft); }
        .ag-done      { border-left-color: #9B9B9B; background: #F2F1EC; color: var(--ink-3); }
        .ag-done .ag-name { color: var(--ink-2); }
      `}</style>
    </Screen>
  );
}

function AgendaToolbar() {
  return (
    <div className="ag-toolbar">
      <div className="ag-week-nav">
        <button><Icon.ChevronLeft /></button>
        <div className="vdv"></div>
        <button style={{width: 'auto', padding: '0 12px', fontSize: 12, fontWeight: 500}}>Aujourd'hui</button>
        <div className="vdv"></div>
        <button><Icon.ChevronRight /></button>
      </div>
      <div style={{fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em'}}>
        20 – 25 avril 2026
      </div>
      <div className="ag-view-toggle" style={{marginLeft: 18}}>
        <button>Jour</button>
        <button className="on">Semaine</button>
        <button>Mois</button>
      </div>

      <div className="ag-legend">
        <span><i style={{background:'#C9D9EE'}}/>Consultation</span>
        <span><i style={{background:'#F1E1A5'}}/>En attente</span>
        <span><i style={{background:'#E4EDF8'}}/>Arrivé</span>
        <span><i style={{background:'#F2F1EC'}}/>Terminé</span>
      </div>
    </div>
  );
}

function AgendaGrid({ onSelect }) {
  // "Now" line at Thursday 09:47
  const nowDay = 'jeu';
  const nowTop = pxFromMin(toMin('09:47'));

  return (
    <div className="ag-grid-wrap">
      <div className="ag-header">
        <div className="ag-header-cell"></div>
        {WEEK_DAYS.map(d => (
          <div key={d.key} className={`ag-header-cell ${d.key === nowDay ? 'today' : ''}`}>
            <span className="d-lbl">{d.label}</span>
            <span className="d-num">{d.date}</span>
          </div>
        ))}
      </div>
      <div className="ag-scroll scroll">
        <div className="ag-grid" style={{height: HOURS.length * ROW_PX}}>
          <div className="ag-hourcol">
            {HOURS.map(h => (
              <div key={h} className="ag-hour-label">{String(h).padStart(2,'0')}:00</div>
            ))}
          </div>
          {WEEK_DAYS.map(d => (
            <div key={d.key} className={`ag-daycol ${d.key === nowDay ? 'today' : ''}`}>
              {HOURS.map(h => (
                <div key={h} className="ag-hour-cell" />
              ))}
              {d.key === nowDay && (
                <div className="ag-now" style={{top: nowTop}}>
                  <span className="ag-now-lbl">09:47</span>
                </div>
              )}
              {APPOINTMENTS.filter(a => a.day === d.key).map((a, i) => (
                <AgendaBlock key={i} a={a} onClick={onSelect} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TodayArrivals() {
  return (
    <>
      <div style={{padding: '14px 16px 10px', borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between'}}>
          <div style={{fontSize: 13, fontWeight: 600}}>Arrivées du jour</div>
          <div style={{fontSize: 11, color: 'var(--ink-3)'}} className="tnum">3 patients</div>
        </div>
        <div style={{fontSize: 11, color: 'var(--ink-3)', marginTop: 2}}>Jeudi 23 avril · mise à jour 09:47</div>
      </div>

      <div style={{flex: 1, overflow: 'auto', padding: 12}} className="scroll">
        {ARRIVALS.map((p, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 8,
          }}>
            <div style={{display:'flex', justifyContent:'space-between', gap: 8}}>
              <div style={{fontWeight: 600, fontSize: 12.5}}>{p.name}</div>
              <span className="tnum" style={{fontSize: 11, color: 'var(--ink-3)'}}>RDV {p.apt}</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap: 6, marginTop: 6, flexWrap: 'wrap'}}>
              <span className={`pill ${p.status}`}>
                <span className="dot" />
                {p.status === 'consult' ? 'En consultation' : p.status === 'vitals' ? 'En attente constantes' : 'Arrivé'}
              </span>
              {p.allergy && (
                <span className="pill allergy"><Icon.Warn /> {p.allergy}</span>
              )}
            </div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)'}}>
              <span style={{fontSize: 11, color: 'var(--ink-3)'}} className="tnum">
                {p.status === 'arrived' ? 'Vient d\'arriver' : `Depuis ${p.since}`}
              </span>
              <button className="btn sm ghost">Dossier →</button>
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 12, padding: 12, border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--r-md)', textAlign: 'center', color: 'var(--ink-3)', fontSize: 11.5,
        }}>
          5 autres RDV attendus aujourd'hui
        </div>
      </div>

      <div style={{padding: 12, borderTop: '1px solid var(--border)', background: 'var(--surface)'}}>
        <button className="btn" style={{width: '100%', justifyContent: 'center'}}>
          Ouvrir la salle d'attente →
        </button>
      </div>
    </>
  );
}

window.AgendaSemaine = AgendaSemaine;
