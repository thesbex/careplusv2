// Screen 10 — Aperçu PDF facture (A4 printable receipt)

function ApercuFacture() {
  return (
    <Screen active="factu" title="Aperçu — Facture" sub="FAC-2026-00482"
      topbarRight={(<>
        <button className="btn">← Retour</button>
        <button className="btn"><Icon.File /> Télécharger PDF</button>
        <button className="btn primary"><Icon.Print /> Imprimer</button>
      </>)}
    >
      <div className="scroll" style={{background: 'var(--bg-alt)', overflow: 'auto', height: '100%'}}>
        <div className="a4">
          {/* Letterhead */}
          <div style={{display:'flex', justifyContent:'space-between', paddingBottom: 18, borderBottom: '2px solid #1E5AA8', marginBottom: 22}}>
            <div>
              <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 24, color:'#1E5AA8', lineHeight: 1}}>
                Cabinet Médical El Amrani
              </div>
              <div style={{fontSize: 11, color:'#555', marginTop: 4, lineHeight: 1.5}}>
                Dr. Karim El Amrani · Médecin Généraliste<br/>
                24, Rue Tahar Sebti — Quartier Gauthier, 20 250 Casablanca<br/>
                Tél. +212 5 22 47 85 20 · contact@cab-elamrani.ma
              </div>
            </div>
            <div style={{textAlign:'right', fontSize: 10.5, color:'#555', lineHeight: 1.6}}>
              <div><strong>ICE</strong> 002 547 810 000 093</div>
              <div><strong>RC</strong> Casablanca 287 415</div>
              <div><strong>Patente</strong> 35 142 801</div>
              <div><strong>IF</strong> 4 028 574</div>
              <div><strong>CNSS</strong> 8 745 201</div>
            </div>
          </div>

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 24}}>
            <div style={{fontFamily: 'Instrument Serif, serif', fontSize: 32, fontStyle:'italic', color:'#1E5AA8', letterSpacing:'-0.01em'}}>
              Facture
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize: 10, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em'}}>N° séquentiel légal</div>
              <div style={{fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 600}}>FAC-2026-00482</div>
              <div style={{fontSize: 11, color:'#444', marginTop: 2}}>Émise le 23/04/2026 à 10:48</div>
            </div>
          </div>

          {/* Patient box */}
          <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24}}>
            <div style={{border: '1px solid #ddd', padding: '10px 14px', borderRadius: 3}}>
              <div style={{fontSize: 10, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em'}}>Facturé à</div>
              <div style={{fontSize: 13, fontWeight: 600, marginTop: 4}}>Mohamed Alami</div>
              <div style={{fontSize: 11, color:'#444'}}>CIN BE 328451</div>
              <div style={{fontSize: 11, color:'#444'}}>CNSS 112 456 789</div>
            </div>
            <div style={{border: '1px solid #ddd', padding: '10px 14px', borderRadius: 3}}>
              <div style={{fontSize: 10, color:'#888', textTransform:'uppercase', letterSpacing:'0.08em'}}>Règlement</div>
              <div style={{fontSize: 13, fontWeight: 600, marginTop: 4}}>Espèces</div>
              <div style={{fontSize: 11, color:'#444'}}>Réglée le 23/04/2026</div>
              <div style={{fontSize: 11, color:'#3F7A3A', fontWeight:600, marginTop: 2}}>✓ Acquittée</div>
            </div>
          </div>

          {/* Table */}
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12}}>
            <thead>
              <tr style={{background: '#F7F5F1', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd'}}>
                <th style={{textAlign:'left', padding: '8px 12px', fontSize: 10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em'}}>Prestation</th>
                <th style={{textAlign:'center', padding: '8px 12px', fontSize: 10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', width: 60}}>Qté</th>
                <th style={{textAlign:'right', padding: '8px 12px', fontSize: 10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', width: 120}}>Prix unitaire</th>
                <th style={{textAlign:'right', padding: '8px 12px', fontSize: 10, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', width: 120}}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{borderBottom: '1px solid #eee'}}>
                <td style={{padding:'10px 12px'}}>
                  <div style={{fontWeight: 550}}>Consultation médicale généraliste</div>
                  <div style={{fontSize: 10.5, color: '#666', marginTop: 2}}>Motif : Consultation de suivi — HTA</div>
                </td>
                <td style={{padding: '10px 12px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace'}}>1</td>
                <td style={{padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace'}}>250,00</td>
                <td style={{padding: '10px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600}}>250,00</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div style={{display:'flex', justifyContent:'flex-end', marginTop: 14}}>
            <div style={{width: 260, fontSize: 12}}>
              <div style={{display:'flex', justifyContent:'space-between', padding: '4px 12px'}}>
                <span style={{color:'#555'}}>Sous-total HT</span>
                <span style={{fontFamily: 'JetBrains Mono, monospace'}}>250,00</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '4px 12px'}}>
                <span style={{color:'#555'}}>TVA (exonérée — art. 91)</span>
                <span style={{fontFamily: 'JetBrains Mono, monospace'}}>0,00</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '10px 12px', background: '#1E5AA8', color: 'white', borderRadius: 3, marginTop: 6, fontWeight: 600}}>
                <span>Total TTC</span>
                <span style={{fontFamily: 'JetBrains Mono, monospace'}}>250,00 MAD</span>
              </div>
            </div>
          </div>

          <div style={{marginTop: 18, padding: '10px 12px', background: '#F7F5F1', fontSize: 10.5, color: '#555', borderRadius: 3, fontStyle: 'italic'}}>
            Arrêtée la présente facture à la somme de <strong>deux cent cinquante dirhams (250,00 MAD)</strong>.
          </div>

          <div style={{marginTop: 50, display:'flex', justifyContent: 'space-between', alignItems:'flex-end'}}>
            <div style={{fontSize: 10, color:'#888', maxWidth: 320, lineHeight: 1.5}}>
              Mention légale : facture émise conformément à la loi n° 9-88 relative aux obligations comptables des commerçants. Numérotation chronologique et continue.
            </div>
            <div style={{textAlign:'center', width: 220}}>
              <div style={{fontSize: 10, color:'#888'}}>Signature et cachet</div>
              <div style={{height: 70, borderBottom: '1px solid #111', marginTop: 4, display:'flex', justifyContent:'center', alignItems:'flex-end', paddingBottom: 8, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 18, color:'#1E5AA8'}}>Dr. K. El Amrani</div>
            </div>
          </div>

          <div style={{position: 'absolute', bottom: 30, left: 64, right: 64, fontSize: 9.5, color:'#888', borderTop: '1px solid #ddd', paddingTop: 8, display:'flex', justifyContent:'space-between', fontFamily: 'JetBrains Mono, monospace'}}>
            <span>FAC-2026-00482 · ICE 002547810000093</span>
            <span>Page 1/1 · careplus</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}

window.ApercuFacture = ApercuFacture;
