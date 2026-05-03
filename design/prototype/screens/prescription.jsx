// Screen 7 — Prescription médicaments (drawer)

function PrescriptionDrawer() {
  const lines = [
    { name: 'Amlodipine 5 mg',     form: 'Comprimé', qty: '1 boîte de 30', pos: '1 cp le matin', dur: '30 jours', note: 'Dose doublée vs. précédente ordonnance' },
    { name: 'Atorvastatine 20 mg', form: 'Comprimé', qty: '1 boîte de 30', pos: '1 cp le soir',  dur: '30 jours' },
    { name: 'Aspirine 100 mg',     form: 'Comprimé', qty: '1 boîte de 30', pos: '1 cp le midi',  dur: '30 jours' },
  ];
  return (
    <Screen active="consult" title="Consultation en cours" sub="Mohamed Alami">
      <div style={{position:'relative', height: '100%'}}>
        {/* dimmed content */}
        <div style={{padding: 28, opacity: 0.35, pointerEvents:'none'}}>
          <div className="panel" style={{padding: 20, maxWidth: 720}}>
            <div style={{fontSize: 13, fontWeight: 600}}>S · Subjectif</div>
            <div style={{fontSize: 12, color:'var(--ink-3)', marginTop: 8}}>Patient hypertendu connu depuis 2018…</div>
          </div>
        </div>
        <div style={{position: 'absolute', inset: 0, background: 'rgba(20,18,12,0.25)'}} />

        {/* drawer */}
        <aside style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 720,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          boxShadow: '-16px 0 40px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{padding: '16px 22px', borderBottom: '1px solid var(--border)', display:'flex', alignItems:'center', gap: 10}}>
            <Icon.Pill />
            <div>
              <div style={{fontSize: 15, fontWeight: 600}}>Prescription médicamenteuse</div>
              <div style={{fontSize: 11.5, color:'var(--ink-3)'}}>Ordonnance n° ORD-2026-0871 · brouillon</div>
            </div>
            <button className="btn icon ghost" style={{marginLeft:'auto'}}><Icon.Close /></button>
          </div>

          {/* allergy banner */}
          <div style={{
            padding: '10px 22px', background: 'var(--amber-soft)', borderBottom: '1px solid #E8CFA9',
            display:'flex', alignItems:'center', gap: 10,
          }}>
            <div style={{color: 'var(--amber)', display:'flex', alignItems:'center', gap: 6, fontWeight:600, fontSize: 12}}>
              <Icon.Warn /> Allergie connue : Pénicilline
            </div>
            <span style={{fontSize: 11.5, color:'var(--ink-2)'}}>Les bêta-lactamines seront bloquées à la prescription</span>
            <span className="pill" style={{marginLeft:'auto', background:'#FFF', borderColor:'#E8CFA9'}}>Aucune interaction détectée</span>
          </div>

          <div className="scroll" style={{flex: 1, overflow: 'auto', padding: 22}}>
            {/* search */}
            <div className="cp-search" style={{maxWidth: '100%', margin: '0 0 16px', background: 'var(--surface)'}}>
              <Icon.Search />
              <input style={{flex:1, border:'none', outline:'none', fontSize: 13, background:'transparent'}} placeholder="Rechercher un médicament — nom commercial ou DCI…" />
              <span className="kbd">DCI</span>
            </div>

            {/* lines */}
            <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 8}}>
              Médicaments ({lines.length})
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{
                border: '1px solid var(--border)', borderRadius: 6, padding: 14, marginBottom: 10,
                background: 'var(--surface)', display: 'grid', gap: 10,
                gridTemplateColumns: '1fr 150px 170px 110px auto',
              }}>
                <div>
                  <div style={{fontSize: 13, fontWeight: 600}}>{l.name}</div>
                  <div style={{fontSize: 11, color: 'var(--ink-3)'}}>{l.form} · Inhib. calcique</div>
                  {l.note && <div style={{fontSize: 11, color: 'var(--amber)', marginTop: 4, display:'flex', gap: 4, alignItems:'center'}}><Icon.Warn /> {l.note}</div>}
                </div>
                <div>
                  <div style={{fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 550, marginBottom: 4}}>QUANTITÉ</div>
                  <div style={{fontSize: 12}}>{l.qty}</div>
                </div>
                <div>
                  <div style={{fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 550, marginBottom: 4}}>POSOLOGIE</div>
                  <div style={{fontSize: 12}}>{l.pos}</div>
                </div>
                <div>
                  <div style={{fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 550, marginBottom: 4}}>DURÉE</div>
                  <div style={{fontSize: 12}}>{l.dur}</div>
                </div>
                <div style={{display:'flex', gap: 4, alignSelf:'start'}}>
                  <button className="btn icon sm ghost"><Icon.Edit /></button>
                  <button className="btn icon sm ghost"><Icon.Trash /></button>
                </div>
              </div>
            ))}

            <button className="btn" style={{width: '100%', justifyContent: 'center'}}><Icon.Plus /> Ajouter un médicament</button>

            {/* saved templates */}
            <div style={{marginTop: 22, fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 8}}>
              Modèles sauvegardés
            </div>
            <div style={{display:'flex', gap: 8, flexWrap: 'wrap'}}>
              {['HTA de base','HTA + dyslipidémie','Renouvellement diabète type II','Angine simple'].map(t => (
                <button key={t} className="btn sm"><Icon.Doc /> {t}</button>
              ))}
            </div>

            {/* recommendations */}
            <div style={{marginTop: 22, fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 8}}>
              Recommandations au patient
            </div>
            <textarea className="textarea" style={{minHeight: 60}} defaultValue="Contrôle tensionnel quotidien à domicile — matin et soir. Limiter la consommation de sel. Consulter immédiatement en cas de céphalées intenses, troubles visuels ou douleurs thoraciques." />
          </div>

          <div style={{
            padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <label style={{display:'flex', alignItems:'center', gap: 6, fontSize: 12, color:'var(--ink-2)'}}>
              <input type="checkbox" defaultChecked /> Générer le PDF
            </label>
            <label style={{display:'flex', alignItems:'center', gap: 6, fontSize: 12, color:'var(--ink-2)'}}>
              <input type="checkbox" /> Envoyer par email
            </label>
            <div style={{marginLeft:'auto', display:'flex', gap: 8}}>
              <button className="btn">Brouillon</button>
              <button className="btn"><Icon.Eye /> Aperçu</button>
              <button className="btn primary"><Icon.Check /> Signer et imprimer</button>
            </div>
          </div>
        </aside>
      </div>
    </Screen>
  );
}

window.PrescriptionDrawer = PrescriptionDrawer;
