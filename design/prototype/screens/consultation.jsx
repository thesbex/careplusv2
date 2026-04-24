// Screen 6 — Écran consultation (doctor's main work screen)

function EcranConsultation() {
  return (
    <Screen active="consult" title="Consultation en cours" sub="Mohamed Alami · Débutée à 09:12">
      <div style={{display: 'grid', gridTemplateColumns: '280px 1fr 320px', height: '100%', overflow: 'hidden'}}>

        {/* Left: patient at a glance */}
        <div style={{borderRight: '1px solid var(--border)', background: 'var(--surface-2)', padding: 16, overflow: 'auto'}} className="scroll">
          <div className="cp-avatar lg" style={{marginBottom: 10}}>MA</div>
          <div style={{fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em'}}>Mohamed Alami</div>
          <div style={{fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2}}>52 ans · ♂ · PT-00482</div>

          <div style={{display:'flex', flexDirection:'column', gap: 4, marginTop: 10, marginBottom: 14}}>
            <span className="pill allergy"><Icon.Warn /> Allergie : Pénicilline</span>
            <span className="pill">HTA · dyslipidémie</span>
          </div>

          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 6}}>Constantes 09:04</div>
          <div className="panel" style={{marginBottom: 14}}>
            <div style={{padding: '10px 12px', fontSize: 12}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--ink-3)'}}>TA</span><span className="tnum" style={{color:'var(--amber)', fontWeight: 600}}>135 / 85</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--ink-3)'}}>FC</span><span className="tnum">72</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--ink-3)'}}>T°</span><span className="tnum">36,8</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--ink-3)'}}>SpO₂</span><span className="tnum">98%</span></div>
              <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'var(--ink-3)'}}>IMC</span><span className="tnum" style={{color:'var(--amber)', fontWeight: 600}}>27,4</span></div>
            </div>
          </div>

          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 6}}>Traitement en cours</div>
          <div style={{fontSize: 12}}>
            <div style={{padding: '6px 0', borderBottom: '1px dashed var(--border)'}}>
              <div style={{fontWeight: 550}}>Amlodipine 5 mg</div>
              <div style={{color:'var(--ink-3)', fontSize: 11}}>1 cp matin · depuis 02/2024</div>
            </div>
            <div style={{padding: '6px 0', borderBottom: '1px dashed var(--border)'}}>
              <div style={{fontWeight: 550}}>Atorvastatine 20 mg</div>
              <div style={{color:'var(--ink-3)', fontSize: 11}}>1 cp soir · depuis 02/2024</div>
            </div>
            <div style={{padding: '6px 0'}}>
              <div style={{fontWeight: 550}}>Aspirine 100 mg</div>
              <div style={{color:'var(--ink-3)', fontSize: 11}}>1 cp midi · depuis 02/2024</div>
            </div>
          </div>

          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginTop: 16, marginBottom: 6}}>Dernier suivi</div>
          <div style={{fontSize: 12, color: 'var(--ink-2)'}}>
            <div>18/03 — TA 128/82, bilan lipidique demandé.</div>
            <div style={{marginTop: 6}}>25/03 — LDL 1.58 g/L (élevé), TG 1.72 g/L.</div>
          </div>
        </div>

        {/* Center: SOAP notes */}
        <div style={{display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
          <div style={{padding: '12px 24px', borderBottom: '1px solid var(--border)', display:'flex', alignItems: 'center', gap: 12, background: 'var(--surface)'}}>
            <span className="pill consult"><span className="dot" /> En consultation</span>
            <span style={{fontSize: 12, color: 'var(--ink-3)'}} className="tnum">Box 1 · Démarrée 09:12 · <strong style={{color:'var(--ink)'}}>0:35:14</strong></span>
            <div style={{marginLeft: 'auto', display: 'flex', gap: 8}}>
              <button className="btn sm"><Icon.Doc /> Modèles</button>
              <button className="btn sm"><Icon.Clipboard /> CIM-10</button>
            </div>
          </div>

          <div className="scroll" style={{padding: '20px 24px', overflow: 'auto', flex: 1}}>

            <SoapBlock letter="S" title="Subjectif — anamnèse" count="96 mots" text={
              "Patient hypertendu connu depuis 2018. Se plaint de céphalées matinales depuis 10 jours, sans nausées ni vertiges. Pas de douleur thoracique, pas de dyspnée d'effort. Observance thérapeutique bonne. Stress professionnel récent. Pas de modification du régime alimentaire. Consomme 2 cafés/j, pas d'alcool, ancien fumeur (arrêté 2019)."
            }/>

            <SoapBlock letter="O" title="Objectif — examen" count="" text={
              "Examen cardio-vasculaire : B1-B2 bien frappés, pas de souffle. Pouls périphériques perçus et symétriques. Auscultation pulmonaire claire. Abdomen souple. Pas d'œdèmes des membres inférieurs. Fond d'œil : stade I. Poids +2 kg depuis dernière visite."
            }/>

            <SoapBlock letter="A" title="Appréciation — diagnostic" noEdit>
              <div style={{display:'flex', flexDirection: 'column', gap: 6}}>
                <DiagPill code="I10" label="Hypertension essentielle — contrôle imparfait" />
                <DiagPill code="E78.5" label="Dyslipidémie non précisée" />
                <button className="btn sm" style={{alignSelf:'flex-start', marginTop: 4}}><Icon.Plus /> Ajouter un diagnostic</button>
              </div>
            </SoapBlock>

            <SoapBlock letter="P" title="Plan — conduite à tenir" noEdit>
              <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                <PlanLine ico="Pill"  text="Prescription — ajustement Amlodipine 5 → 10 mg" active />
                <PlanLine ico="Flask" text="Analyses — bilan lipidique de contrôle dans 8 semaines" />
                <PlanLine ico="Scan"  text="Imagerie — ECG de repos" />
                <PlanLine ico="Calendar" text="Prochain RDV suivi dans 4 semaines" />
              </div>
            </SoapBlock>

          </div>

          <div style={{padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display:'flex', gap: 8, alignItems:'center'}}>
            <span style={{fontSize: 11.5, color: 'var(--ink-3)'}}>
              <Icon.Check /> Enregistré automatiquement · 09:46:58
            </span>
            <div style={{marginLeft:'auto', display:'flex', gap: 8}}>
              <button className="btn">Suspendre</button>
              <button className="btn"><Icon.Print /> Certificat</button>
              <button className="btn primary">Clôturer et facturer →</button>
            </div>
          </div>
        </div>

        {/* Right: actions rapides */}
        <div style={{borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: 16, overflow: 'auto'}} className="scroll">
          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 8}}>Actions</div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
            <ActionBtn icon="Pill"  color="primary" label="Prescription médicaments" sub="Ordonnance · 1 en cours" />
            <ActionBtn icon="Flask" label="Bon d'analyses" sub="Biologie médicale" />
            <ActionBtn icon="Scan"  label="Bon d'imagerie" sub="Radio · écho · IRM" />
            <ActionBtn icon="Doc"   label="Certificat médical" />
            <ActionBtn icon="Calendar" label="Prochain RDV" />
          </div>

          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', margin: '18px 0 8px'}}>Documents générés</div>
          <div style={{fontSize: 12}}>
            <DocRow title="Ordonnance — 3 médicaments" meta="Non signée · brouillon" />
          </div>

          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', margin: '18px 0 8px'}}>Facturation</div>
          <div className="panel" style={{padding: '10px 12px', fontSize: 12.5}}>
            <div style={{display:'flex', justifyContent:'space-between', padding: '2px 0'}}>
              <span style={{color:'var(--ink-3)'}}>Consultation</span>
              <span className="tnum">250,00 MAD</span>
            </div>
            <div style={{display:'flex', justifyContent:'space-between', padding: '2px 0', paddingTop: 6, marginTop: 4, borderTop: '1px solid var(--border)', fontWeight: 600}}>
              <span>Total à régler</span>
              <span className="tnum">250,00 MAD</span>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function SoapBlock({ letter, title, count, text, noEdit, children }) {
  return (
    <div style={{marginBottom: 20}}>
      <div style={{display:'flex', alignItems:'baseline', gap: 10, marginBottom: 8}}>
        <span style={{
          width: 26, height: 26, background: 'var(--primary)', color: 'white', borderRadius: 4,
          display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
        }}>{letter}</span>
        <span style={{fontSize: 13, fontWeight: 600}}>{title}</span>
        {count && <span style={{marginLeft:'auto', fontSize: 11, color:'var(--ink-3)'}}>{count}</span>}
      </div>
      {text && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)',
          padding: '12px 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--ink)',
        }}>{text}<span style={{borderLeft: '1.5px solid var(--primary)', marginLeft: 2, animation: 'blink 1s infinite'}}>&nbsp;</span></div>
      )}
      {children && (
        <div style={{border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', padding: 12}}>{children}</div>
      )}
    </div>
  );
}
function DiagPill({ code, label }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap: 8, padding: '6px 10px', background: 'var(--primary-soft)', borderRadius: 4}}>
      <span className="mono" style={{fontSize: 11, color: 'var(--primary)', fontWeight: 600}}>{code}</span>
      <span style={{fontSize: 12.5}}>{label}</span>
      <button className="btn icon ghost sm" style={{marginLeft:'auto'}}><Icon.Close /></button>
    </div>
  );
}
function PlanLine({ ico, text, active }) {
  const Ico = Icon[ico];
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 10, padding: '8px 12px', borderRadius: 4,
      background: active ? 'var(--primary-soft)' : 'transparent',
      border: active ? '1px solid var(--primary)' : '1px solid transparent',
    }}>
      <span style={{color: active ? 'var(--primary)' : 'var(--ink-3)'}}><Ico /></span>
      <span style={{fontSize: 12.5, flex: 1}}>{text}</span>
      {active && <span className="pill consult" style={{fontSize: 9.5}}>Brouillon</span>}
    </div>
  );
}
function ActionBtn({ icon, label, sub, color }) {
  const Ico = Icon[icon];
  return (
    <button style={{
      border: '1px solid var(--border)',
      background: color === 'primary' ? 'var(--primary-soft)' : 'var(--surface)',
      borderColor: color === 'primary' ? 'var(--primary)' : 'var(--border)',
      borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center',
      gap: 10, cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{color: color === 'primary' ? 'var(--primary)' : 'var(--ink-2)'}}><Ico /></span>
      <div style={{flex: 1}}>
        <div style={{fontSize: 12.5, fontWeight: 550}}>{label}</div>
        {sub && <div style={{fontSize: 10.5, color:'var(--ink-3)', marginTop: 1}}>{sub}</div>}
      </div>
      <span style={{color:'var(--ink-3)'}}><Icon.ChevronRight /></span>
    </button>
  );
}
function DocRow({ title, meta }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap: 10, padding:'8px 10px', border:'1px solid var(--border)', borderRadius: 6, background: 'var(--surface)'}}>
      <Icon.File />
      <div style={{flex:1}}>
        <div style={{fontSize: 12.5, fontWeight: 550}}>{title}</div>
        <div style={{fontSize: 10.5, color: 'var(--ink-3)'}}>{meta}</div>
      </div>
      <button className="btn icon ghost sm"><Icon.Eye /></button>
    </div>
  );
}

window.EcranConsultation = EcranConsultation;
