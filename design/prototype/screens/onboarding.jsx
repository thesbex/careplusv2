// Screen 13 — Onboarding wizard (first launch)

function Onboarding() {
  const steps = [
    { n: 1, label: 'Cabinet',     done: true },
    { n: 2, label: 'Médecin',     done: true },
    { n: 3, label: 'Horaires',    active: true },
    { n: 4, label: 'Équipe' },
    { n: 5, label: 'Tarifs' },
    { n: 6, label: 'Documents' },
    { n: 7, label: 'Prêt' },
  ];
  return (
    <div style={{width: 1440, height: 900, background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', color: 'var(--ink)'}}>
      {/* Top bar */}
      <div style={{height: 60, padding: '0 28px', display:'flex', alignItems:'center', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--surface)'}}>
        <div className="cp-brand-mark" style={{width: 28, height: 28, fontSize: 18}}>c</div>
        <span style={{fontSize: 15, fontWeight: 600}}>careplus</span>
        <span className="pill" style={{marginLeft: 10}}>Configuration initiale</span>
        <span style={{marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)'}}>
          Session : Dr. Karim El Amrani · <a style={{color: 'var(--primary)'}}>Déconnexion</a>
        </span>
      </div>

      {/* Progress rail */}
      <div style={{display:'flex', justifyContent:'center', padding: '24px 40px', background: 'var(--surface)', borderBottom: '1px solid var(--border)'}}>
        <div style={{display:'flex', alignItems:'center', gap: 6}}>
          {steps.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{display:'flex', alignItems:'center', gap: 10}}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: s.done ? 'var(--primary)' : s.active ? 'var(--primary-soft)' : 'var(--surface)',
                  border: `1.5px solid ${s.done ? 'var(--primary)' : s.active ? 'var(--primary)' : 'var(--border-strong)'}`,
                  color: s.done ? 'white' : s.active ? 'var(--primary)' : 'var(--ink-3)',
                  display:'grid', placeItems:'center', fontSize: 12, fontWeight: 600,
                }}>
                  {s.done ? <Icon.Check /> : s.n}
                </div>
                <span style={{
                  fontSize: 12.5, fontWeight: s.active || s.done ? 600 : 500,
                  color: s.active ? 'var(--primary)' : s.done ? 'var(--ink-2)' : 'var(--ink-3)',
                }}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <div style={{width: 40, height: 1, background: s.done ? 'var(--primary)' : 'var(--border)'}} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{flex: 1, display:'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden'}}>
        <div className="scroll" style={{overflow: 'auto', padding: '36px 48px'}}>
          <div style={{maxWidth: 680}}>
            <div style={{fontSize: 11, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10}}>
              Étape 3 sur 7
            </div>
            <div style={{fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12}}>
              Quand recevez-vous vos patients ?
            </div>
            <div style={{fontSize: 14, color: 'var(--ink-3)', marginBottom: 28, lineHeight: 1.55, maxWidth: 560}}>
              Ces horaires déterminent les créneaux proposés par l'agenda et les messages envoyés aux patients. Vous pourrez les modifier à tout moment depuis les paramètres.
            </div>

            {/* Quick templates */}
            <div style={{marginBottom: 18}}>
              <div style={{fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8, fontWeight: 550}}>Démarrer depuis un modèle</div>
              <div style={{display:'flex', gap: 8}}>
                {[
                  { t: 'Cabinet classique', sub: 'Lun–Sam, 8:30–19:00' },
                  { t: 'Journée continue',  sub: 'Lun–Ven, 9:00–17:00' },
                  { t: 'Demi-journées',     sub: 'Matins seulement' },
                ].map((m,i)=>(
                  <button key={m.t} className="btn" style={{
                    flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                    height: 'auto', padding: '10px 14px', flex: 1,
                    background: i===0 ? 'var(--primary-soft)' : 'var(--surface)',
                    borderColor: i===0 ? 'var(--primary)' : 'var(--border)',
                  }}>
                    <span style={{fontSize: 12.5, fontWeight: 600, color: i===0 ? 'var(--primary)' : 'var(--ink)'}}>{m.t}</span>
                    <span style={{fontSize: 11, color: 'var(--ink-3)', fontWeight: 400}}>{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hours */}
            <div className="panel" style={{padding: '6px 16px'}}>
              {[
                { d: 'Lundi',    m: '08:30', m2: '12:30', a: '14:30', a2: '19:00', on: true },
                { d: 'Mardi',    m: '08:30', m2: '12:30', a: '14:30', a2: '19:00', on: true },
                { d: 'Mercredi', m: '08:30', m2: '12:30', a: '14:30', a2: '19:00', on: true },
                { d: 'Jeudi',    m: '08:30', m2: '12:30', a: '14:30', a2: '19:00', on: true },
                { d: 'Vendredi', m: '08:30', m2: '12:30', a: '15:30', a2: '19:00', on: true },
                { d: 'Samedi',   m: '09:00', m2: '13:00', a: '',      a2: '',      on: true, half: true },
                { d: 'Dimanche', m: '',      m2: '',      a: '',      a2: '',      on: false },
              ].map(h => (
                <div key={h.d} style={{display:'grid', gridTemplateColumns: '100px 60px 1fr 1fr 40px', gap: 10, alignItems:'center', padding: '10px 0', borderBottom: '1px dashed var(--border)'}}>
                  <span style={{fontWeight: 550, fontSize: 13}}>{h.d}</span>
                  <label style={{display:'flex', alignItems:'center', gap: 5, fontSize: 11, color: 'var(--ink-3)'}}>
                    <input type="checkbox" defaultChecked={h.on} />{h.on ? 'Ouvert' : 'Fermé'}
                  </label>
                  {h.on ? (
                    <div style={{display:'flex', gap: 4, alignItems:'center', opacity: h.on ? 1 : 0.4}}>
                      <input className="input tnum" defaultValue={h.m} style={{height: 32}} />
                      <span>–</span>
                      <input className="input tnum" defaultValue={h.m2} style={{height: 32}} />
                    </div>
                  ) : <div style={{fontSize: 11, color: 'var(--ink-4)'}}>—</div>}
                  {h.on && !h.half ? (
                    <div style={{display:'flex', gap: 4, alignItems:'center'}}>
                      <input className="input tnum" defaultValue={h.a} style={{height: 32}} />
                      <span>–</span>
                      <input className="input tnum" defaultValue={h.a2} style={{height: 32}} />
                    </div>
                  ) : <div style={{fontSize: 11, color: 'var(--ink-4)'}}>{h.half ? 'Demi-journée' : '—'}</div>}
                  <button className="btn icon ghost sm"><Icon.Edit /></button>
                </div>
              ))}
            </div>

            <div style={{marginTop: 18, display:'flex', gap: 10, fontSize: 12}}>
              <label style={{display:'flex', gap: 6, alignItems:'center'}}><input type="checkbox" defaultChecked /> Pause déjeuner automatique</label>
              <label style={{display:'flex', gap: 6, alignItems:'center'}}><input type="checkbox" /> Créneau urgences réservé</label>
              <label style={{display:'flex', gap: 6, alignItems:'center'}}><input type="checkbox" defaultChecked /> Respecter les jours fériés marocains</label>
            </div>
          </div>
        </div>

        {/* Preview sidebar */}
        <div style={{borderLeft: '1px solid var(--border)', background: 'var(--surface-2)', padding: 24, overflow: 'auto'}} className="scroll">
          <div style={{fontSize: 11, color: 'var(--ink-3)', fontWeight: 550, textTransform:'uppercase', letterSpacing: '0.08em', marginBottom: 8}}>
            Aperçu agenda
          </div>
          <div className="panel" style={{padding: 0, overflow: 'hidden'}}>
            <div style={{display:'grid', gridTemplateColumns: '30px repeat(6, 1fr)', fontSize: 9, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '6px 0'}}>
              <span></span>
              {['L','M','M','J','V','S'].map((d,i)=>(<span key={i} style={{textAlign:'center', color: 'var(--ink-3)', fontWeight: 600}}>{d}</span>))}
            </div>
            {[8,9,10,11,12,13,14,15,16,17,18,19].map(h => (
              <div key={h} style={{display:'grid', gridTemplateColumns: '30px repeat(6, 1fr)', borderBottom: '1px solid var(--border-soft)', height: 24}}>
                <span style={{fontSize: 9, color: 'var(--ink-4)', textAlign: 'right', paddingRight: 4, paddingTop: 2}} className="tnum">{h}h</span>
                {[0,1,2,3,4,5].map(d => {
                  const closed = (d === 5 && h >= 13) || (h === 12 || h === 13) && !(d === 5 && h === 12);
                  const isLunch = h === 12 || h === 13;
                  const isSatAfter = d === 5 && h >= 13;
                  return <div key={d} style={{borderLeft: '1px solid var(--border-soft)', background: isLunch || isSatAfter ? 'repeating-linear-gradient(-45deg, transparent, transparent 4px, var(--border-soft) 4px, var(--border-soft) 5px)' : 'white'}}/>;
                })}
              </div>
            ))}
          </div>
          <div style={{fontSize: 11, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5}}>
            <div style={{display:'flex', alignItems:'center', gap: 6, marginBottom: 4}}>
              <span style={{width: 10, height: 10, border: '1px solid var(--border-strong)', background: 'white'}} /> Disponible
            </div>
            <div style={{display:'flex', alignItems:'center', gap: 6}}>
              <span style={{width: 10, height: 10, background: 'repeating-linear-gradient(-45deg, transparent, transparent 2px, var(--border-strong) 2px, var(--border-strong) 3px)'}} /> Fermé
            </div>
          </div>

          <div style={{marginTop: 24, padding: 14, background: 'var(--primary-soft)', borderRadius: 6, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5}}>
            <strong style={{color: 'var(--primary)'}}>💡 Conseil</strong><br/>
            Des créneaux plus courts (15 min) conviennent aux suivis. Les premières consultations gagnent à être réservées sur 30 min.
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{height: 68, borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 8}}>
        <button className="btn"><Icon.ChevronLeft /> Précédent</button>
        <div style={{marginLeft: 'auto', display:'flex', gap: 8}}>
          <button className="btn ghost">Passer cette étape</button>
          <button className="btn primary lg">Continuer — Équipe <Icon.ChevronRight /></button>
        </div>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
