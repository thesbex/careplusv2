// Screen 2 — Prise de RDV (new appointment modal)
// Rendered over the Agenda screen as a backdrop + dialog.

function PriseRDV() {
  const [date, setDate] = React.useState('24/04/2026');
  const [time, setTime] = React.useState('10:30');
  const [dur, setDur]   = React.useState(20);
  const [patient, setPatient] = React.useState(null);

  const suggestions = [
    { name: 'Salma Bennani',   phone: '+212 6 61 23 45 67', last: '12/03/2026', tags: ['Patient connu'] },
    { name: 'Salma Benkirane',  phone: '+212 6 12 98 76 54', last: '—', tags: ['Nouveau'] },
    { name: 'Salim Bouazzaoui', phone: '+212 6 55 14 22 08', last: '02/11/2025', tags: ['Patient connu'] },
  ];

  return (
    <div style={{position: 'relative'}}>
      {/* Page behind */}
      <AgendaSemaine />
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0, background: 'rgba(20,18,12,0.35)',
        backdropFilter: 'blur(1px)', display: 'grid', placeItems: 'center', zIndex: 10,
      }}>
        <div style={{
          width: 720, maxHeight: 720, background: 'var(--surface)',
          borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{display:'flex', alignItems:'center', padding: '14px 18px', borderBottom: '1px solid var(--border)'}}>
            <div>
              <div style={{fontSize: 15, fontWeight: 600}}>Nouveau rendez-vous</div>
              <div style={{fontSize: 11.5, color:'var(--ink-3)', marginTop: 2}}>
                Renseigner le patient et le créneau — le RDV sera ajouté à l'agenda
              </div>
            </div>
            <button className="btn icon ghost" style={{marginLeft: 'auto'}}><Icon.Close /></button>
          </div>

          <div style={{padding: 20, overflow: 'auto'}} className="scroll">
            {/* Step 1: patient search */}
            <div style={{marginBottom: 18}}>
              <div style={{fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color:'var(--ink-3)', marginBottom: 8}}>
                Étape 1 · Patient
              </div>
              <div className="cp-search" style={{maxWidth: '100%', margin: 0, background: 'var(--surface)'}}>
                <Icon.Search />
                <input style={{flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent'}}
                       defaultValue="Salma B"
                       placeholder="Nom, téléphone ou CIN…" />
                <button className="btn sm" style={{marginLeft: 'auto'}}><Icon.Plus /> Nouveau</button>
              </div>
              <div style={{border: '1px solid var(--border)', borderRadius: 6, marginTop: 8, background: 'var(--surface)'}}>
                {suggestions.map((s, i) => (
                  <div key={i}
                    onClick={() => setPatient(s)}
                    style={{
                      display:'flex', alignItems:'center', gap: 12,
                      padding: '10px 12px',
                      borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-soft)' : 'none',
                      cursor: 'pointer',
                      background: patient?.name === s.name ? 'var(--primary-soft)' : 'transparent',
                  }}>
                    <div className="cp-avatar sm">{s.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                    <div style={{flex: 1}}>
                      <div style={{fontWeight: 550, fontSize: 12.5}}>{s.name}</div>
                      <div className="tnum" style={{fontSize: 11, color: 'var(--ink-3)'}}>{s.phone} · Dernière visite : {s.last}</div>
                    </div>
                    {s.tags.map(t => <span key={t} className="pill">{t}</span>)}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: créneau */}
            <div style={{marginBottom: 18}}>
              <div style={{fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color:'var(--ink-3)', marginBottom: 8}}>
                Étape 2 · Créneau
              </div>
              <div style={{display:'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10}}>
                <div className="field">
                  <label>Date</label>
                  <input className="input tnum" value={date} onChange={e=>setDate(e.target.value)} />
                  <span className="help">Format JJ/MM/AAAA</span>
                </div>
                <div className="field">
                  <label>Heure</label>
                  <input className="input tnum" value={time} onChange={e=>setTime(e.target.value)} />
                  <span className="help">Créneau disponible</span>
                </div>
                <div className="field">
                  <label>Durée</label>
                  <select className="select" value={dur} onChange={e=>setDur(+e.target.value)}>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>

              <div style={{marginTop: 10, padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 11.5, color: 'var(--ink-3)', display:'flex', alignItems:'center', gap:8}}>
                <Icon.Clock />
                <span>Créneaux libres vendredi : <strong style={{color:'var(--ink)'}}>10:30</strong> · 11:30 · 14:00 · 16:45</span>
              </div>
            </div>

            {/* Step 3: motif */}
            <div>
              <div style={{fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color:'var(--ink-3)', marginBottom: 8}}>
                Étape 3 · Motif
              </div>
              <div className="field" style={{marginBottom: 10}}>
                <label>Type</label>
                <div style={{display:'flex', gap: 6, flexWrap: 'wrap'}}>
                  {['Première consultation', 'Consultation de suivi', 'Renouvellement', 'Résultats', 'Vaccination', 'Certificat'].map((t,i) => (
                    <button key={t} className="btn sm" style={{
                      background: i === 1 ? 'var(--primary-soft)' : 'var(--surface)',
                      borderColor: i === 1 ? 'var(--primary)' : 'var(--border)',
                      color: i === 1 ? 'var(--primary)' : 'var(--ink)',
                      fontWeight: i === 1 ? 600 : 500,
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Note pour le médecin (facultatif)</label>
                <textarea className="textarea" placeholder="Ex. Apporter carnet de vaccination, résultats de la dernière prise de sang, etc." />
              </div>
            </div>
          </div>

          <div style={{
            borderTop: '1px solid var(--border)', padding: '12px 18px',
            display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface-2)',
          }}>
            <label style={{fontSize: 12, color:'var(--ink-2)', display:'flex', alignItems:'center', gap: 6}}>
              <input type="checkbox" defaultChecked /> Envoyer un SMS de confirmation
            </label>
            <div style={{marginLeft: 'auto', display:'flex', gap: 8}}>
              <button className="btn">Annuler</button>
              <button className="btn primary">Confirmer le RDV</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PriseRDV = PriseRDV;
