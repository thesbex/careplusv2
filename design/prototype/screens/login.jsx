// Screen 12 — Login

function Login() {
  return (
    <div style={{
      width: 1440, height: 900, background: 'var(--bg)', display: 'grid',
      gridTemplateColumns: '1fr 1fr', fontFamily: 'var(--font-sans)', color: 'var(--ink)',
    }}>
      {/* Left: brand panel */}
      <div style={{
        background: 'linear-gradient(155deg, #1E5AA8 0%, #174585 50%, #112F5C 100%)',
        padding: 56, color: 'white', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* decorative grid */}
        <div style={{position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />

        <div style={{display:'flex', alignItems:'center', gap: 12, zIndex: 1}}>
          <div style={{
            width: 34, height: 34, background: 'white', color: '#1E5AA8',
            borderRadius: 6, display: 'grid', placeItems: 'center',
            fontFamily: "'Inter Tight', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em',
          }}>c</div>
          <span style={{fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em'}}>careplus</span>
        </div>

        <div style={{marginTop: 'auto', zIndex: 1}}>
          <div style={{fontSize: 44, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.025em', maxWidth: 480}}>
            La gestion de votre cabinet,<br/>
            <span style={{color: '#A8C5E8', fontWeight: 500}}>simplement.</span>
          </div>
          <div style={{fontSize: 15, color: 'rgba(255,255,255,0.75)', marginTop: 18, maxWidth: 440, lineHeight: 1.55}}>
            careplus accompagne les médecins généralistes marocains, de la prise de rendez-vous à l'édition des ordonnances et des factures conformes.
          </div>

          <div style={{display:'flex', gap: 32, marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.6)'}}>
            <div>
              <div className="tnum" style={{fontSize: 24, fontWeight: 600, color: 'white', letterSpacing: '-0.02em'}}>184</div>
              <div>Cabinets au Maroc</div>
            </div>
            <div>
              <div className="tnum" style={{fontSize: 24, fontWeight: 600, color: 'white', letterSpacing: '-0.02em'}}>62k</div>
              <div>Consultations / mois</div>
            </div>
            <div>
              <div className="tnum" style={{fontSize: 24, fontWeight: 600, color: 'white', letterSpacing: '-0.02em'}}>99,98%</div>
              <div>Disponibilité</div>
            </div>
          </div>

          <div style={{marginTop: 60, fontSize: 11, color: 'rgba(255,255,255,0.5)', display:'flex', gap: 16}}>
            <span>© 2026 careplus SARL</span>
            <span>·</span>
            <span>Hébergement HDS — Casablanca</span>
            <span>·</span>
            <span>Conforme loi 09-08</span>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div style={{display:'grid', placeItems: 'center', padding: 56}}>
        <div style={{width: 380}}>
          <div style={{fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.1em', color: 'var(--primary)', marginBottom: 12}}>
            Connexion professionnelle
          </div>
          <div style={{fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8}}>
            Bon retour, docteur.
          </div>
          <div style={{fontSize: 13, color: 'var(--ink-3)', marginBottom: 32}}>
            Accédez à votre cabinet. Vos identifiants sont strictement personnels.
          </div>

          <div className="field" style={{marginBottom: 14}}>
            <label>Adresse email</label>
            <input className="input" defaultValue="f.benjelloun@cab-elamrani.ma" style={{height: 40}} />
          </div>
          <div className="field" style={{marginBottom: 8}}>
            <label>Mot de passe</label>
            <div style={{position: 'relative'}}>
              <input className="input" type="password" defaultValue="••••••••••••" style={{height: 40, paddingRight: 38}} />
              <button className="btn icon ghost sm" style={{position: 'absolute', right: 4, top: 4}}><Icon.Eye /></button>
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 22, fontSize: 12}}>
            <label style={{display:'flex', gap: 6, alignItems:'center', color: 'var(--ink-2)'}}>
              <input type="checkbox" defaultChecked /> Garder ma session
            </label>
            <a style={{color: 'var(--primary)', textDecoration: 'none', fontWeight: 550}}>Mot de passe oublié ?</a>
          </div>

          <button className="btn primary lg" style={{width: '100%', justifyContent: 'center', height: 44, fontSize: 14}}>
            <Icon.Lock /> Se connecter
          </button>

          <div style={{display:'flex', alignItems:'center', gap: 12, margin: '24px 0', color: 'var(--ink-4)', fontSize: 11}}>
            <div style={{flex: 1, height: 1, background: 'var(--border)'}} />
            <span>OU</span>
            <div style={{flex: 1, height: 1, background: 'var(--border)'}} />
          </div>

          <button className="btn" style={{width: '100%', justifyContent: 'center', height: 40}}>
            Connexion par code SMS envoyé au cabinet
          </button>

          <div style={{marginTop: 32, padding: 14, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: 12, display: 'flex', gap: 10, alignItems:'start'}}>
            <span style={{color: 'var(--primary)'}}><Icon.Lock /></span>
            <div>
              <div style={{fontWeight: 600, marginBottom: 2}}>Connexion sécurisée</div>
              <div style={{color: 'var(--ink-3)', fontSize: 11.5}}>Vos données patient sont chiffrées et hébergées au Maroc, conformément à la loi 09-08 sur la protection des données personnelles.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Login = Login;
