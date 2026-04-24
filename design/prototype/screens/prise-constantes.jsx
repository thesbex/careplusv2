// Screen 5 — Prise des constantes (vital signs form)

function PriseConstantes() {
  return (
    <Screen active="salle" title="Prise des constantes" sub="Youssef Ziani · 38 ans · RDV 10:00">
      <div style={{display:'grid', gridTemplateColumns: '1fr 360px', height: '100%', overflow: 'hidden'}}>
        <div className="scroll" style={{overflow: 'auto', padding: '20px 28px'}}>
          <div style={{maxWidth: 720}}>
            <div style={{marginBottom: 20}}>
              <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)'}}>Étape 1 · Mesures</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12, marginTop: 10}}>
                {[
                  { ico: 'Heart',  label: 'Tension artérielle', unit: 'mmHg', value: '132 / 84', norm: 'Normale haute', warn: true },
                  { ico: 'Heart',  label: 'Fréquence cardiaque', unit: 'bpm', value: '78', norm: 'Normale' },
                  { ico: 'Thermo', label: 'Température',        unit: '°C',  value: '36,9', norm: 'Normale' },
                  { ico: 'Dot',    label: 'SpO₂',               unit: '%',   value: '98',   norm: 'Normale' },
                  { ico: 'Dot',    label: 'Poids',              unit: 'kg',  value: '74',   norm: '—' },
                  { ico: 'Dot',    label: 'Taille',             unit: 'cm',  value: '178',  norm: '—' },
                ].map((v) => {
                  const Ico = Icon[v.ico];
                  return (
                    <div key={v.label} className="panel" style={{padding: '12px 14px'}}>
                      <div style={{display:'flex', alignItems:'center', gap: 8, color: v.warn ? 'var(--amber)' : 'var(--primary)'}}><Ico />
                        <span style={{fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 550}}>{v.label}</span>
                      </div>
                      <div style={{display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8}}>
                        <input className="input tnum" defaultValue={v.value} style={{
                          height: 44, fontSize: 24, fontWeight: 500, padding: '0 10px',
                          borderColor: v.warn ? 'var(--amber)' : 'var(--border)',
                          background: v.warn ? 'var(--amber-soft)' : 'var(--surface)',
                        }} />
                        <span style={{fontSize: 12, color: 'var(--ink-3)'}}>{v.unit}</span>
                      </div>
                      <div style={{fontSize: 10.5, color: v.warn ? 'var(--amber)' : 'var(--ink-3)', marginTop: 4}}>{v.norm}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:'flex', alignItems:'center', gap: 8, marginTop: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 11.5, color: 'var(--ink-3)'}}>
                <Icon.Clock /> IMC calculé : <strong style={{color:'var(--ink)'}}>23.4</strong> — Normal · Périmètre abdominal et glycémie capillaire en option ci-dessous.
              </div>
            </div>

            <div style={{marginBottom: 20}}>
              <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)'}}>Étape 2 · Mesures optionnelles</div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10}}>
                <div className="field"><label>Glycémie capillaire (g/L)</label><input className="input" placeholder="—" /></div>
                <div className="field"><label>Périmètre abdominal (cm)</label><input className="input" placeholder="—" /></div>
                <div className="field"><label>FR (/min)</label><input className="input" placeholder="—" /></div>
              </div>
            </div>

            <div style={{marginBottom: 20}}>
              <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)'}}>Étape 3 · Motif & contexte</div>
              <div className="field" style={{marginTop: 10}}>
                <label>Motif déclaré par le patient</label>
                <textarea className="textarea" defaultValue="Patient vient pour première consultation. Se plaint de fatigue depuis 2 semaines, maux de tête le matin. Antécédents familiaux : père hypertendu." />
              </div>
              <div style={{display:'flex', gap: 10, marginTop: 10}}>
                <label style={{display:'flex', alignItems:'center', gap:6, fontSize: 12.5}}><input type="checkbox" /> À jeun</label>
                <label style={{display:'flex', alignItems:'center', gap:6, fontSize: 12.5}}><input type="checkbox" defaultChecked /> Carnet de santé apporté</label>
                <label style={{display:'flex', alignItems:'center', gap:6, fontSize: 12.5}}><input type="checkbox" /> Résultats d'analyses apportés</label>
              </div>
            </div>
          </div>
        </div>

        <div style={{borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: 16, overflow:'auto'}} className="scroll">
          <div style={{display:'flex', alignItems:'center', gap: 10, marginBottom: 14}}>
            <div className="cp-avatar lg">YZ</div>
            <div>
              <div style={{fontWeight: 600, fontSize: 14}}>Youssef Ziani</div>
              <div style={{fontSize: 11, color: 'var(--ink-3)'}}>38 ans · ♂ · Première consultation</div>
            </div>
          </div>

          <div className="panel" style={{marginBottom: 12}}>
            <div className="panel-h">Repères (H 30-50 ans)</div>
            <div style={{padding: '10px 14px', fontSize: 12}}>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0'}}><span style={{color:'var(--ink-3)'}}>TA</span><span className="tnum">&lt; 130 / 80</span></div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0'}}><span style={{color:'var(--ink-3)'}}>FC</span><span className="tnum">60 – 100 bpm</span></div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0'}}><span style={{color:'var(--ink-3)'}}>T°</span><span className="tnum">36,1 – 37,2 °C</span></div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0'}}><span style={{color:'var(--ink-3)'}}>SpO₂</span><span className="tnum">≥ 95%</span></div>
              <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0'}}><span style={{color:'var(--ink-3)'}}>IMC</span><span className="tnum">18,5 – 25</span></div>
            </div>
          </div>

          <div style={{padding: 12, background: 'var(--amber-soft)', borderRadius: 6, border: '1px solid #E8CFA9', fontSize: 12, color: 'var(--ink-2)', marginBottom: 14}}>
            <div style={{display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, color: 'var(--amber)', marginBottom: 4}}>
              <Icon.Warn /> TA légèrement élevée
            </div>
            Le patient sera orienté en consultation. Le médecin en sera informé.
          </div>

          <button className="btn primary lg" style={{width:'100%', justifyContent:'center'}}>Envoyer en consultation →</button>
          <button className="btn" style={{width:'100%', justifyContent:'center', marginTop: 8}}>Enregistrer et remettre en attente</button>
          <div style={{fontSize: 11, color: 'var(--ink-3)', textAlign:'center', marginTop: 10}}>
            Saisi par Leila Berrada · Assistante · 09:47
          </div>
        </div>
      </div>
    </Screen>
  );
}

window.PriseConstantes = PriseConstantes;
