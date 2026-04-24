// Screen 9 — Facturation (list + editor)

function Facturation() {
  const rows = [
    { n: 'FAC-2026-00482', date: '23/04/2026', patient: 'Mohamed Alami',    motif: 'Consultation de suivi',   amt: 250, status: 'Payée',    mode: 'Espèces' },
    { n: 'FAC-2026-00481', date: '23/04/2026', patient: 'Samira Bennani',   motif: 'Renouvellement',          amt: 200, status: 'Payée',    mode: 'TPE' },
    { n: 'FAC-2026-00480', date: '22/04/2026', patient: 'Hassan El Fassi',  motif: 'Consultation',             amt: 250, status: 'En attente', mode: '—' },
    { n: 'FAC-2026-00479', date: '22/04/2026', patient: 'Zineb Ouazzani',   motif: 'Suivi thyroïde',          amt: 250, status: 'Payée',    mode: 'Espèces' },
    { n: 'FAC-2026-00478', date: '22/04/2026', patient: 'Leila Chraibi',    motif: 'Vaccination',             amt: 180, status: 'Payée',    mode: 'TPE' },
    { n: 'FAC-2026-00477', date: '21/04/2026', patient: 'Karim Berrada',    motif: 'Douleurs lombaires',      amt: 250, status: 'Payée',    mode: 'Espèces' },
    { n: 'FAC-2026-00476', date: '21/04/2026', patient: 'Amina Touhami',    motif: 'Certificat médical',       amt: 150, status: 'Payée',    mode: 'TPE' },
    { n: 'FAC-2026-00475', date: '20/04/2026', patient: 'Rachid Mansouri',  motif: 'Première consultation',    amt: 300, status: 'Annulée',  mode: '—' },
  ];
  return (
    <Screen active="factu" title="Facturation" sub="Avril 2026"
      topbarRight={(<>
        <button className="btn"><Icon.File /> Export Excel</button>
        <button className="btn primary"><Icon.Plus /> Nouvelle facture</button>
      </>)}
    >
      <div style={{display:'grid', gridTemplateColumns: '1fr 420px', height: '100%', overflow: 'hidden'}}>
        <div style={{overflow: 'auto', padding: 20}} className="scroll">
          {/* KPI strip */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18}}>
            {[
              { k: 'Recettes avril', v: '14 850', u: 'MAD', sub: '+8% vs. mars' },
              { k: 'Factures émises',v: '64',    sub: '22 jours ouvrés' },
              { k: 'Non réglées',    v: '3',     sub: '550 MAD', warn: true },
              { k: 'Ticket moyen',   v: '232',   u: 'MAD', sub: 'Consultation' },
            ].map(c => (
              <div key={c.k} className="panel" style={{padding: '12px 14px'}}>
                <div style={{fontSize: 11, color:'var(--ink-3)', fontWeight: 550, textTransform: 'uppercase', letterSpacing: '0.06em'}}>{c.k}</div>
                <div style={{display: 'baseline', marginTop: 4}}>
                  <span className="tnum" style={{fontSize: 26, fontWeight: 600, letterSpacing:'-0.02em', color: c.warn?'var(--amber)':'var(--ink)'}}>{c.v}</span>
                  {c.u && <span style={{fontSize: 12, color: 'var(--ink-3)', marginLeft: 4}}>{c.u}</span>}
                </div>
                <div style={{fontSize: 11, color: c.warn? 'var(--amber)' : 'var(--ink-3)', marginTop: 2}}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center'}}>
            <div className="cp-search" style={{margin: 0, flex: 1, maxWidth: 360, background: 'var(--surface)'}}>
              <Icon.Search /><span>Rechercher une facture, patient, numéro…</span>
            </div>
            <button className="btn sm">Toutes</button>
            <button className="btn sm" style={{background: 'var(--primary-soft)', borderColor: 'var(--primary)', color: 'var(--primary)'}}>Payées · 60</button>
            <button className="btn sm">En attente · 3</button>
            <button className="btn sm">Annulées · 1</button>
            <button className="btn sm" style={{marginLeft: 'auto'}}><Icon.Calendar /> Avril 2026</button>
          </div>

          <div className="panel">
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
              <thead>
                <tr style={{background: 'var(--surface-2)', borderBottom: '1px solid var(--border)'}}>
                  {['N° facture','Date','Patient','Motif','Montant','Statut','Mode',''].map(h => (
                    <th key={h} style={{textAlign: 'left', padding: '8px 14px', fontWeight: 600, fontSize: 11, color:'var(--ink-3)', textTransform:'uppercase', letterSpacing:'0.06em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{borderBottom: '1px solid var(--border-soft)', background: i === 0 ? 'var(--primary-soft)' : 'transparent'}}>
                    <td className="mono" style={{padding:'10px 14px', fontSize: 11.5}}>{r.n}</td>
                    <td className="tnum" style={{padding:'10px 14px'}}>{r.date}</td>
                    <td style={{padding:'10px 14px', fontWeight: 550}}>{r.patient}</td>
                    <td style={{padding:'10px 14px', color: 'var(--ink-3)'}}>{r.motif}</td>
                    <td className="tnum" style={{padding:'10px 14px', fontWeight: 600, textAlign: 'right'}}>{r.amt.toFixed(2).replace('.', ',')} MAD</td>
                    <td style={{padding:'10px 14px'}}>
                      <span className={`pill ${r.status==='Payée' ? 'done' : r.status==='Annulée' ? '' : 'waiting'}`}
                            style={r.status==='Annulée' ? {background: '#F5E1DC', color: '#A8321E'} : {}}>
                        {r.status==='Payée' && <Icon.Check />}{r.status}
                      </span>
                    </td>
                    <td style={{padding:'10px 14px', color:'var(--ink-3)', fontSize: 11.5}}>{r.mode}</td>
                    <td style={{padding:'10px 14px', textAlign:'right'}}>
                      <button className="btn icon ghost sm"><Icon.Eye /></button>
                      <button className="btn icon ghost sm"><Icon.Print /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{padding: '10px 14px', display:'flex', alignItems:'center', borderTop:'1px solid var(--border)', fontSize: 11.5, color:'var(--ink-3)'}}>
              <span>Affichage 1 – 8 sur 64</span>
              <div style={{marginLeft:'auto', display:'flex', gap: 4}}>
                <button className="btn sm">← Précédent</button>
                <button className="btn sm">Suivant →</button>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div style={{borderLeft:'1px solid var(--border)', background:'var(--surface-2)', overflow: 'auto'}} className="scroll">
          <div style={{padding: '14px 20px', borderBottom: '1px solid var(--border)'}}>
            <div style={{fontSize: 11, color: 'var(--ink-3)', fontWeight: 550, textTransform:'uppercase', letterSpacing:'0.08em'}}>Facture sélectionnée</div>
            <div style={{display:'flex', alignItems:'baseline', gap: 10, marginTop: 2}}>
              <span className="mono" style={{fontSize: 13, fontWeight: 600}}>FAC-2026-00482</span>
              <span className="pill done"><Icon.Check />Payée</span>
            </div>
          </div>
          <div style={{padding: 20}}>
            <div className="field" style={{marginBottom: 10}}>
              <label>Patient</label>
              <input className="input" defaultValue="Mohamed Alami" disabled style={{background: 'var(--bg)'}} />
            </div>
            <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10}}>
              <div className="field"><label>Date</label><input className="input tnum" defaultValue="23/04/2026" /></div>
              <div className="field"><label>N° séquentiel</label><input className="input mono" value="FAC-2026-00482" disabled style={{background: 'var(--bg)'}} /></div>
            </div>

            <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginTop: 16, marginBottom: 8}}>Lignes</div>
            <div className="panel" style={{padding: 0}}>
              <div style={{display:'grid', gridTemplateColumns: '1fr 60px 90px 20px', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--ink-3)', fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.06em'}}>
                <span>Prestation</span><span>Qté</span><span style={{textAlign:'right'}}>PU</span><span></span>
              </div>
              <div style={{display:'grid', gridTemplateColumns: '1fr 60px 90px 20px', gap: 8, padding: '10px 12px', alignItems:'center'}}>
                <span style={{fontSize: 12.5}}>Consultation généraliste</span>
                <span className="tnum" style={{fontSize: 12.5}}>1</span>
                <span className="tnum" style={{fontSize: 12.5, textAlign: 'right'}}>250,00</span>
                <button className="btn icon ghost sm"><Icon.Close /></button>
              </div>
              <div style={{padding: '4px 12px 10px'}}>
                <button className="btn sm" style={{width:'100%', justifyContent:'center'}}><Icon.Plus /> Ajouter une ligne</button>
              </div>
            </div>

            <div style={{marginTop: 14, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6}}>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0', fontSize: 12.5}}>
                <span style={{color:'var(--ink-3)'}}>Sous-total</span><span className="tnum">250,00 MAD</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0', fontSize: 12.5}}>
                <span style={{color:'var(--ink-3)'}}>Remise</span><span className="tnum">— 0,00 MAD</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '6px 0 2px', borderTop:'1px solid var(--border)', marginTop: 4, fontWeight: 600, fontSize: 14}}>
                <span>Total</span><span className="tnum">250,00 MAD</span>
              </div>
            </div>

            <div className="field" style={{marginTop: 14}}>
              <label>Mode de règlement</label>
              <div style={{display:'flex', gap: 6}}>
                {['Espèces','Chèque','TPE','Virement'].map((m,i)=>(
                  <button key={m} className="btn sm" style={{
                    flex: 1, justifyContent: 'center',
                    background: i===0 ? 'var(--primary-soft)' : 'var(--surface)',
                    borderColor: i===0 ? 'var(--primary)' : 'var(--border)',
                    color: i===0 ? 'var(--primary)' : 'var(--ink)',
                    fontWeight: i===0 ? 600 : 500,
                  }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{display:'flex', gap: 8, marginTop: 16}}>
              <button className="btn" style={{flex: 1, justifyContent:'center'}}><Icon.Eye /> Aperçu</button>
              <button className="btn primary" style={{flex: 1, justifyContent:'center'}}><Icon.Print /> Imprimer reçu</button>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

window.Facturation = Facturation;
