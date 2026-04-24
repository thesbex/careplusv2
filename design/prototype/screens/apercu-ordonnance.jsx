// Screen 8 — Aperçu PDF ordonnance (A4 printable)

function ApercuOrdonnance() {
  return (
    <Screen active="consult" title="Aperçu — Ordonnance médicale" sub="ORD-2026-0871"
      topbarRight={(<>
        <button className="btn">← Retour</button>
        <button className="btn"><Icon.File /> Télécharger PDF</button>
        <button className="btn primary"><Icon.Print /> Imprimer</button>
      </>)}
    >
      <div className="scroll" style={{background: 'var(--bg-alt)', overflow: 'auto', height: '100%'}}>
        <div className="a4">
          {/* A4 letterhead */}
          <div style={{display:'flex', borderBottom: '2px solid #1E5AA8', paddingBottom: 14, marginBottom: 22}}>
            <div style={{flex:1}}>
              <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 26, letterSpacing:'-0.01em', color:'#1E5AA8', lineHeight: 1}}>
                Dr. Karim El Amrani
              </div>
              <div style={{fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.5}}>
                Médecin Généraliste · Diplômé de la Faculté de Médecine de Casablanca<br/>
                Inscrit à l'Ordre National des Médecins — N° 14 328<br/>
                INPE : 0287541 · Code Médecin : CA-GEN-01428
              </div>
            </div>
            <div style={{textAlign: 'right', fontSize: 11, color: '#555', lineHeight: 1.6}}>
              <div style={{fontWeight: 600, color: '#111'}}>Cabinet Médical El Amrani</div>
              24, Rue Tahar Sebti — Quartier Gauthier<br/>
              20 250 Casablanca<br/>
              +212 5 22 47 85 20<br/>
              contact@cab-elamrani.ma
            </div>
          </div>

          {/* Meta row */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 20, marginBottom: 24}}>
            <div>
              <div style={{fontSize: 10, color:'#888', textTransform: 'uppercase', letterSpacing:'0.08em'}}>Patient</div>
              <div style={{fontSize: 14, fontWeight: 600, marginTop: 3}}>Mohamed Alami</div>
              <div style={{fontSize: 11, color:'#444'}}>Né le 14/07/1973 (52 ans) · ♂</div>
              <div style={{fontSize: 11, color:'#444'}}>CIN BE 328451 · CNSS 112 456 789</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize: 10, color:'#888', textTransform: 'uppercase', letterSpacing:'0.08em'}}>Ordonnance</div>
              <div style={{fontSize: 14, fontWeight: 600, marginTop: 3, fontFamily: 'JetBrains Mono, monospace'}}>ORD-2026-0871</div>
              <div style={{fontSize: 11, color:'#444'}}>Casablanca, le 23 avril 2026</div>
            </div>
          </div>

          <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 32, fontStyle: 'italic', color:'#1E5AA8', marginBottom: 18, letterSpacing:'-0.01em'}}>
            Ordonnance
          </div>

          {/* Rx */}
          <div style={{fontSize: 13, lineHeight: 1.9}}>
            <div style={{marginBottom: 18, paddingLeft: 20, borderLeft: '3px solid #1E5AA8'}}>
              <div style={{fontWeight: 600}}>1. Amlodipine 5 mg</div>
              <div style={{color: '#222'}}>Prendre <strong>1 comprimé le matin</strong>, pendant <strong>30 jours</strong>.</div>
              <div style={{color: '#555', fontSize: 11}}>Qsp 1 boîte de 30 comprimés</div>
            </div>
            <div style={{marginBottom: 18, paddingLeft: 20, borderLeft: '3px solid #1E5AA8'}}>
              <div style={{fontWeight: 600}}>2. Atorvastatine 20 mg</div>
              <div style={{color: '#222'}}>Prendre <strong>1 comprimé le soir</strong>, pendant <strong>30 jours</strong>.</div>
              <div style={{color: '#555', fontSize: 11}}>Qsp 1 boîte de 30 comprimés</div>
            </div>
            <div style={{marginBottom: 18, paddingLeft: 20, borderLeft: '3px solid #1E5AA8'}}>
              <div style={{fontWeight: 600}}>3. Aspirine 100 mg</div>
              <div style={{color: '#222'}}>Prendre <strong>1 comprimé au déjeuner</strong>, pendant <strong>30 jours</strong>.</div>
              <div style={{color: '#555', fontSize: 11}}>Qsp 1 boîte de 30 comprimés</div>
            </div>
          </div>

          <div style={{marginTop: 24, padding: 14, background: '#F7F5F1', borderRadius: 4, fontSize: 12}}>
            <div style={{fontWeight: 600, marginBottom: 4}}>Recommandations</div>
            Contrôle tensionnel quotidien à domicile — matin et soir. Limiter la consommation de sel.
            Consulter immédiatement en cas de céphalées intenses, troubles visuels ou douleurs thoraciques.
            Prochain rendez-vous dans 4 semaines.
          </div>

          {/* Signature */}
          <div style={{marginTop: 40, display:'flex', justifyContent:'flex-end'}}>
            <div style={{textAlign:'center', width: 240}}>
              <div style={{fontSize: 11, color:'#888'}}>Signature et cachet</div>
              <div style={{
                height: 80, borderBottom: '1px solid #111', marginTop: 6,
                fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 22, color: '#1E5AA8',
                display:'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10,
              }}>Dr. K. El Amrani</div>
              <div style={{fontSize: 11, color:'#444', marginTop: 4}}>Dr. Karim El Amrani</div>
            </div>
          </div>

          <div style={{position: 'absolute', bottom: 30, left: 64, right: 64, fontSize: 9.5, color:'#888', borderTop: '1px solid #ddd', paddingTop: 8, display:'flex', justifyContent:'space-between', fontFamily: 'JetBrains Mono, monospace'}}>
            <span>ORD-2026-0871 · émise le 23/04/2026 à 09:48</span>
            <span>Page 1/1 · careplus</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

window.ApercuOrdonnance = ApercuOrdonnance;
