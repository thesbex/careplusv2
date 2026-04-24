// Screen 3 — Dossier patient

function DossierPatient() {
  const [tab, setTab] = React.useState('timeline');
  const tabs = [
    { id: 'timeline',    label: 'Chronologie' },
    { id: 'consults',    label: 'Consultations', count: 14 },
    { id: 'prescr',      label: 'Prescriptions', count: 22 },
    { id: 'analyses',    label: 'Analyses', count: 9 },
    { id: 'imagerie',    label: 'Imagerie', count: 3 },
    { id: 'docs',        label: 'Documents', count: 7 },
    { id: 'factu',       label: 'Facturation', count: 14 },
  ];

  return (
    <Screen active="patients" title="Patients" sub="Mohamed Alami · Dossier N° PT-00482">
      <div style={{display:'flex', flexDirection:'column', height:'100%'}}>

        {/* Patient header */}
        <div style={{
          padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div className="cp-avatar lg" style={{background: '#1E5AA8'}}>MA</div>
          <div style={{flex: 1}}>
            <div style={{display:'flex', alignItems:'baseline', gap: 10}}>
              <div style={{fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em'}}>Mohamed Alami</div>
              <span className="pill">♂ Homme · 52 ans</span>
              <span className="pill">CIN BE 328451</span>
            </div>
            <div style={{display:'flex', gap: 16, fontSize: 12, color: 'var(--ink-3)', marginTop: 6}} className="tnum">
              <span>Né le 14/07/1973</span>
              <span>+212 6 61 12 34 56</span>
              <span>malami@gmail.com</span>
              <span>Groupe O+</span>
              <span>CNSS · 112 456 789</span>
            </div>
          </div>
          <div style={{display:'flex', gap: 8}}>
            <button className="btn"><Icon.Print /> Imprimer</button>
            <button className="btn"><Icon.Edit /> Modifier</button>
            <button className="btn primary"><Icon.Plus /> Nouvelle consultation</button>
          </div>
        </div>

        {/* Alerts strip */}
        <div style={{
          padding: '10px 20px', display: 'flex', gap: 10, alignItems: 'center',
          background: 'var(--amber-soft)', borderBottom: '1px solid #E8CFA9',
        }}>
          <div style={{color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12}}>
            <Icon.Warn /> Allergie
          </div>
          <span style={{fontSize: 12.5, color: 'var(--ink)'}}>Pénicilline <span style={{color:'var(--ink-3)'}}>(réaction cutanée, signalée 2019)</span></span>
          <div style={{width: 1, height: 16, background: '#E8CFA9', margin: '0 8px'}} />
          <div style={{display:'flex', gap: 10, fontSize: 12}}>
            <span><strong>ATCD :</strong> HTA (2018), Dyslipidémie</span>
            <span style={{color:'var(--ink-3)'}}>·</span>
            <span><strong>Traitement chronique :</strong> Amlodipine 5mg, Atorvastatine 20mg</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex', gap: 2, padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)'}}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '11px 14px', border: 'none', background: 'transparent',
              borderBottom: `2px solid ${tab === t.id ? 'var(--primary)' : 'transparent'}`,
              color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: tab === t.id ? 600 : 500, fontSize: 12.5, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.count && <span style={{
                fontSize: 10.5, background: tab===t.id ? 'var(--primary-soft)' : 'var(--bg-alt)',
                color: tab===t.id ? 'var(--primary)' : 'var(--ink-3)',
                padding: '1px 6px', borderRadius: 8, fontWeight: 600,
              }}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden'}}>
          {/* Timeline */}
          <div className="scroll" style={{padding: '20px 24px', overflow: 'auto'}}>
            <div style={{fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 12}}>
              Chronologie médicale
            </div>

            {[
              { date: '23/04/2026', time: '09:12', kind: 'consult', title: 'Consultation de suivi', who: 'Dr. Karim El Amrani', summary: 'TA 135/85 — Légère augmentation par rapport au dernier contrôle. Ajustement posologique Amlodipine discuté.', tags: ['Ordonnance', 'HTA'], live: true },
              { date: '18/03/2026', time: '10:30', kind: 'consult', title: 'Consultation de suivi', who: 'Dr. Karim El Amrani', summary: 'Examen cardiovasculaire normal. Bilan lipidique demandé.', tags: ['Ordonnance', 'Bilan'] },
              { date: '25/03/2026', time: '—',     kind: 'analyse', title: 'Bilan lipidique — Labo Atlas', summary: 'Cholestérol total 2.35 g/L, LDL 1.58 g/L, HDL 0.42 g/L, TG 1.72 g/L', tags: ['Résultat reçu'] },
              { date: '10/02/2026', time: '11:00', kind: 'consult', title: 'Consultation', who: 'Dr. Karim El Amrani', summary: 'Patient asymptomatique. Renouvellement traitement chronique.', tags: ['Ordonnance'] },
              { date: '14/01/2026', time: '—',     kind: 'doc',     title: 'Certificat médical — sport',  tags: ['Document'] },
              { date: '12/11/2025', time: '09:45', kind: 'consult', title: 'Consultation',                   who: 'Dr. Karim El Amrani', summary: 'Contrôle tensionnel. TA 128/82. Adaptation régime alimentaire conseillée.', tags: ['Ordonnance'] },
            ].map((e, i) => (
              <div key={i} style={{
                display:'grid', gridTemplateColumns: '88px 16px 1fr', gap: 14, paddingBottom: 16,
              }}>
                <div className="tnum" style={{textAlign:'right', paddingTop: 2}}>
                  <div style={{fontSize: 12, fontWeight: 600}}>{e.date}</div>
                  <div style={{fontSize: 11, color: 'var(--ink-3)'}}>{e.time}</div>
                </div>
                <div style={{position: 'relative', display: 'flex', justifyContent: 'center'}}>
                  <div style={{position:'absolute', top: 0, bottom: -16, width: 1, background: 'var(--border)'}} />
                  <div style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: e.live ? 'var(--primary)' : 'var(--surface)',
                    border: `2px solid ${e.live ? 'var(--primary)' : 'var(--border-strong)'}`,
                    marginTop: 4, zIndex: 1,
                  }} />
                </div>
                <div style={{
                  background: e.live ? 'var(--primary-soft)' : 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px',
                }}>
                  <div style={{display:'flex', alignItems:'center', gap: 8}}>
                    <span style={{fontWeight: 600, fontSize: 13}}>{e.title}</span>
                    {e.live && <span className="pill consult"><span className="dot" />En cours</span>}
                    <span style={{marginLeft:'auto', display:'flex', gap: 4}}>
                      {e.tags.map(t => <span key={t} className="pill">{t}</span>)}
                    </span>
                  </div>
                  {e.who && <div style={{fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2}}>{e.who}</div>}
                  {e.summary && <div style={{fontSize: 12.5, marginTop: 6, color: 'var(--ink-2)'}}>{e.summary}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Right summary */}
          <div style={{borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', overflow: 'auto', padding: 16}} className="scroll">
            <SummaryCard title="Constantes — dernière visite" date="23/04/2026">
              <KV k="TA" v="135 / 85 mmHg" warn />
              <KV k="FC" v="72 bpm" />
              <KV k="T°" v="36.8 °C" />
              <KV k="SpO₂" v="98%" />
              <KV k="Poids" v="82 kg" />
              <KV k="IMC" v="27.4" warn />
            </SummaryCard>

            <SummaryCard title="Traitement en cours" date="Depuis 02/2024">
              <Med name="Amlodipine 5 mg" pos="1 cp le matin" />
              <Med name="Atorvastatine 20 mg" pos="1 cp le soir" />
              <Med name="Aspirine 100 mg" pos="1 cp le midi" />
            </SummaryCard>

            <SummaryCard title="Consentements & administratif">
              <KV k="RGPD signé" v="12/03/2024" />
              <KV k="CNSS à jour" v="Oui · exp. 12/2026" />
              <KV k="Mutuelle" v="—" />
            </SummaryCard>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function SummaryCard({ title, date, children }) {
  return (
    <div className="panel" style={{marginBottom: 12}}>
      <div className="panel-h" style={{display:'flex'}}>
        <span>{title}</span>
        {date && <span style={{marginLeft:'auto', fontWeight: 400, fontSize: 11, color: 'var(--ink-3)'}}>{date}</span>}
      </div>
      <div style={{padding: '10px 14px'}}>{children}</div>
    </div>
  );
}
function KV({ k, v, warn }) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', padding: '3px 0', fontSize: 12.5}}>
      <span style={{color: 'var(--ink-3)'}}>{k}</span>
      <span className="tnum" style={{fontWeight: 550, color: warn ? 'var(--amber)' : 'var(--ink)'}}>{v}</span>
    </div>
  );
}
function Med({ name, pos }) {
  return (
    <div style={{padding: '6px 0', borderBottom: '1px dashed var(--border)'}}>
      <div style={{fontWeight: 550, fontSize: 12.5}}>{name}</div>
      <div style={{fontSize: 11.5, color: 'var(--ink-3)'}}>{pos}</div>
    </div>
  );
}

window.DossierPatient = DossierPatient;
