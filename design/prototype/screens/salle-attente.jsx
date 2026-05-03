// Screen 4 — Salle d'attente (assistant view)

function SalleAttente() {
  const patients = [
    { name: 'Mohamed Alami',   apt: '09:00', arrived: '08:54', status: 'consult', waited: '—', room: 'Box 1', allergy: 'Pénicilline', age: 52, reason: 'Consultation de suivi' },
    { name: 'Fatima Z. Lahlou',apt: '09:30', arrived: '09:22', status: 'waiting', waited: '25 min', room: '—', age: 29, reason: 'Suivi grossesse 24 SA' },
    { name: 'Youssef Ziani',   apt: '10:00', arrived: '09:41', status: 'vitals',  waited: '6 min',  room: 'Constantes', age: 38, reason: 'Première consultation' },
    { name: 'Ahmed Cherkaoui', apt: '15:00', arrived: '09:46', status: 'arrived', waited: '1 min',  room: '—', allergy: 'Aspirine', age: 61, reason: 'Suivi HTA' },
  ];

  return (
    <Screen active="salle" title="Salle d'attente"
      sub="Jeudi 23 avril 2026 · 4 patients présents"
      pageDate="09:47"
      topbarRight={(<>
        <button className="btn"><Icon.Print /> Liste</button>
        <button className="btn primary"><Icon.Plus /> Déclarer arrivée</button>
      </>)}
    >
      <div style={{padding: 20, overflow:'auto'}} className="scroll">
        {/* KPIs */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 12, marginBottom: 18}}>
          {[
            { k: 'Arrivés', v: '4', sub: '2 en avance' },
            { k: 'Attente moyenne', v: '11', unit: 'min', sub: 'Objectif ≤ 15 min' },
            { k: 'En consultation', v: '1', sub: 'Dr. El Amrani · Box 1' },
            { k: 'Retards', v: '0', sub: 'Aucun' },
          ].map(c => (
            <div key={c.k} className="panel" style={{padding: '12px 14px'}}>
              <div style={{fontSize: 11, color:'var(--ink-3)', fontWeight: 550, textTransform: 'uppercase', letterSpacing: '0.06em'}}>{c.k}</div>
              <div style={{display:'baseline', marginTop: 4}}>
                <span className="tnum" style={{fontSize: 26, fontWeight: 600, letterSpacing:'-0.02em'}}>{c.v}</span>
                {c.unit && <span style={{fontSize: 13, color: 'var(--ink-3)', marginLeft: 4}}>{c.unit}</span>}
              </div>
              <div style={{fontSize: 11, color:'var(--ink-3)', marginTop: 2}}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className="panel">
          <div className="panel-h">
            <span>File d'attente</span>
            <span style={{marginLeft:'auto', fontSize: 11, color: 'var(--ink-3)', fontWeight: 400}}>Trié par heure d'arrivée</span>
          </div>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
            <thead>
              <tr style={{background: 'var(--surface-2)', borderBottom: '1px solid var(--border)'}}>
                {['Patient', 'RDV', 'Arrivé à', 'Attente', 'Motif', 'Statut', 'Box', ''].map((h,i) => (
                  <th key={i} style={{textAlign: 'left', padding: '8px 14px', fontWeight: 600, fontSize: 11, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.06em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patients.map((p, i) => (
                <tr key={i} style={{borderBottom: '1px solid var(--border-soft)'}}>
                  <td style={{padding: '12px 14px'}}>
                    <div style={{display:'flex', alignItems:'center', gap: 10}}>
                      <div className="cp-avatar sm">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                      <div>
                        <div style={{fontWeight: 600, display:'flex', alignItems:'center', gap: 6}}>
                          {p.name}
                          {p.allergy && <span className="pill allergy" style={{fontSize: 9.5}}><Icon.Warn /> {p.allergy}</span>}
                        </div>
                        <div style={{fontSize: 11, color:'var(--ink-3)'}}>{p.age} ans · {p.reason}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tnum" style={{padding: '12px 14px'}}>{p.apt}</td>
                  <td className="tnum" style={{padding: '12px 14px'}}>{p.arrived}</td>
                  <td className="tnum" style={{padding: '12px 14px', color: p.waited.includes('25') ? 'var(--amber)' : 'var(--ink-2)', fontWeight: p.waited.includes('25') ? 600 : 400}}>{p.waited}</td>
                  <td style={{padding: '12px 14px', color:'var(--ink-3)'}}>{p.reason}</td>
                  <td style={{padding: '12px 14px'}}><span className={`pill ${p.status}`}><span className="dot" />{
                    p.status==='consult'?'En consultation':p.status==='vitals'?'En constantes':p.status==='waiting'?'En attente':'Arrivé'
                  }</span></td>
                  <td style={{padding: '12px 14px', color: 'var(--ink-3)', fontSize: 11.5}}>{p.room}</td>
                  <td style={{padding: '12px 14px', textAlign:'right'}}>
                    <div style={{display:'inline-flex', gap: 6}}>
                      {p.status === 'arrived' && <button className="btn sm primary">Prendre constantes →</button>}
                      {p.status === 'vitals' && <button className="btn sm">Envoyer en consult. →</button>}
                      {p.status === 'waiting' && <button className="btn sm">Appeler</button>}
                      <button className="btn sm icon ghost"><Icon.MoreH /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upcoming */}
        <div style={{marginTop: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 8}}>
          RDV prévus — pas encore arrivés
        </div>
        <div className="panel" style={{padding: '4px 0'}}>
          {[
            { n: 'Samira Bennani', t: '11:00', in_: 'dans 1h 13min' },
            { n: 'Omar Idrissi',   t: '14:30', in_: 'cet après-midi' },
            { n: 'Nadia Fassi',    t: '16:00', in_: 'cet après-midi' },
          ].map((p,i)=>(
            <div key={i} style={{display:'flex', alignItems:'center', gap: 12, padding:'8px 14px', borderBottom: i<2?'1px dashed var(--border)':'none'}}>
              <div className="cp-avatar sm" style={{background:'#D6D0C3', color:'var(--ink-2)'}}>{p.n.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
              <div style={{flex:1, fontSize: 12.5, fontWeight: 550}}>{p.n}</div>
              <div className="tnum" style={{fontSize: 12, color: 'var(--ink-3)'}}>{p.t} <span style={{color:'var(--ink-4)'}}>· {p.in_}</span></div>
              <button className="btn sm ghost">Marquer arrivé</button>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

window.SalleAttente = SalleAttente;
