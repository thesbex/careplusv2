// Screen 11 — Paramétrage cabinet

function Parametrage() {
  const [section, setSection] = React.useState('cabinet');
  const sections = [
    { id: 'cabinet',  label: 'Informations du cabinet' },
    { id: 'horaires', label: "Horaires d'ouverture" },
    { id: 'users',    label: 'Utilisateurs', count: 3 },
    { id: 'roles',    label: 'Rôles et permissions' },
    { id: 'tarifs',   label: 'Prestations et tarifs' },
    { id: 'templates',label: 'Modèles de documents' },
    { id: 'meds',     label: 'Catalogue médicaments' },
    { id: 'factu',    label: 'Séquence de facturation' },
    { id: 'impression', label: 'Impression et papier' },
    { id: 'sauvegarde', label: 'Sauvegarde & sécurité' },
  ];

  return (
    <Screen active="params" title="Paramètres du cabinet" sub="Cabinet Médical El Amrani">
      <div style={{display:'grid', gridTemplateColumns: '260px 1fr', height: '100%', overflow: 'hidden'}}>
        <div style={{borderRight: '1px solid var(--border)', background: 'var(--surface-2)', padding: 16, overflow: 'auto'}} className="scroll">
          {sections.map(s => (
            <div key={s.id} onClick={() => setSection(s.id)} style={{
              padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
              background: section === s.id ? 'var(--surface)' : 'transparent',
              color: section === s.id ? 'var(--primary)' : 'var(--ink-2)',
              fontWeight: section === s.id ? 600 : 500,
              fontSize: 12.5,
              border: section === s.id ? '1px solid var(--border)' : '1px solid transparent',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{s.label}</span>
              {s.count && <span style={{marginLeft:'auto', fontSize: 10.5, color:'var(--ink-3)'}}>{s.count}</span>}
            </div>
          ))}
        </div>

        <div style={{overflow: 'auto', padding: '24px 32px'}} className="scroll">
          <div style={{fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 20}}>
            Informations du cabinet
          </div>

          {/* Cabinet info */}
          <div className="panel" style={{padding: 18, marginBottom: 16}}>
            <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: 14}}>
              <div className="field"><label>Raison sociale</label><input className="input" defaultValue="Cabinet Médical El Amrani" /></div>
              <div className="field"><label>Médecin responsable</label><input className="input" defaultValue="Dr. Karim El Amrani" /></div>
              <div className="field" style={{gridColumn: 'span 2'}}><label>Adresse</label><input className="input" defaultValue="24, Rue Tahar Sebti — Quartier Gauthier" /></div>
              <div className="field"><label>Ville</label><input className="input" defaultValue="Casablanca" /></div>
              <div className="field"><label>Code postal</label><input className="input tnum" defaultValue="20 250" /></div>
              <div className="field"><label>Téléphone</label><input className="input tnum" defaultValue="+212 5 22 47 85 20" /></div>
              <div className="field"><label>Email</label><input className="input" defaultValue="contact@cab-elamrani.ma" /></div>
            </div>

            <div style={{marginTop: 20, fontSize: 11, fontWeight: 600, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--ink-3)', marginBottom: 10}}>
              Identifiants légaux (figurent sur les factures)
            </div>
            <div style={{display:'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14}}>
              <div className="field"><label>ICE</label><input className="input mono tnum" defaultValue="002547810000093" /></div>
              <div className="field"><label>RC</label><input className="input tnum" defaultValue="287 415" /></div>
              <div className="field"><label>Patente</label><input className="input tnum" defaultValue="35 142 801" /></div>
              <div className="field"><label>Identifiant fiscal (IF)</label><input className="input tnum" defaultValue="4 028 574" /></div>
              <div className="field"><label>CNSS</label><input className="input tnum" defaultValue="8 745 201" /></div>
              <div className="field"><label>INPE médecin</label><input className="input tnum" defaultValue="0287541" /></div>
            </div>
          </div>

          {/* Horaires */}
          <div className="panel" style={{padding: 18, marginBottom: 16}}>
            <div style={{fontSize: 13, fontWeight: 600, marginBottom: 12}}>Horaires d'ouverture</div>
            {[
              { d: 'Lundi',    m: '08:30 – 12:30', a: '14:30 – 19:00' },
              { d: 'Mardi',    m: '08:30 – 12:30', a: '14:30 – 19:00' },
              { d: 'Mercredi', m: '08:30 – 12:30', a: '14:30 – 19:00' },
              { d: 'Jeudi',    m: '08:30 – 12:30', a: '14:30 – 19:00' },
              { d: 'Vendredi', m: '08:30 – 12:30', a: '15:30 – 19:00' },
              { d: 'Samedi',   m: '09:00 – 13:00', a: 'Fermé' },
              { d: 'Dimanche', m: 'Fermé',          a: 'Fermé' },
            ].map(h => (
              <div key={h.d} style={{display:'grid', gridTemplateColumns: '120px 1fr 1fr 80px', gap: 10, alignItems:'center', padding: '8px 0', borderBottom: '1px dashed var(--border)'}}>
                <span style={{fontWeight: 550, fontSize: 12.5}}>{h.d}</span>
                <input className="input tnum sm" defaultValue={h.m} style={{height: 30}} />
                <input className="input tnum sm" defaultValue={h.a} style={{height: 30}} />
                <label style={{display:'flex', alignItems:'center', gap: 6, fontSize: 12}}>
                  <input type="checkbox" defaultChecked={h.m !== 'Fermé'} />Ouvert
                </label>
              </div>
            ))}
          </div>

          {/* Users */}
          <div className="panel" style={{marginBottom: 16}}>
            <div style={{padding: '14px 18px', borderBottom: '1px solid var(--border)', display:'flex', alignItems:'center'}}>
              <span style={{fontSize: 13, fontWeight: 600}}>Utilisateurs</span>
              <span style={{marginLeft:'auto'}}><button className="btn sm primary"><Icon.Plus /> Ajouter</button></span>
            </div>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 12.5}}>
              <thead>
                <tr style={{background: 'var(--surface-2)', borderBottom: '1px solid var(--border)'}}>
                  {['Nom','Rôle','Email','Dernière connexion','Statut',''].map(h => (
                    <th key={h} style={{textAlign: 'left', padding: '8px 14px', fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { n: 'Dr. Karim El Amrani', r: 'Médecin', e: 'k.elamrani@cab-elamrani.ma',  l: '23/04/2026 08:15', a: true },
                  { n: 'Fatima Zahra Benjelloun', r: 'Secrétaire', e: 'f.benjelloun@cab-elamrani.ma', l: '23/04/2026 08:02', a: true, me: true },
                  { n: 'Leila Berrada', r: 'Assistante médicale', e: 'l.berrada@cab-elamrani.ma', l: '23/04/2026 08:20', a: true },
                ].map((u, i) => (
                  <tr key={i} style={{borderBottom: '1px solid var(--border-soft)'}}>
                    <td style={{padding: '10px 14px', display:'flex', alignItems:'center', gap: 10}}>
                      <div className="cp-avatar sm">{u.n.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
                      <span style={{fontWeight: 550}}>{u.n}</span>
                      {u.me && <span className="pill">vous</span>}
                    </td>
                    <td style={{padding: '10px 14px'}}>{u.r}</td>
                    <td style={{padding: '10px 14px', color: 'var(--ink-3)'}} className="mono">{u.e}</td>
                    <td className="tnum" style={{padding: '10px 14px', color: 'var(--ink-3)'}}>{u.l}</td>
                    <td style={{padding: '10px 14px'}}><span className="pill" style={{background:'var(--success-soft)', color:'var(--success)'}}><Icon.Check /> Actif</span></td>
                    <td style={{padding: '10px 14px', textAlign:'right'}}><button className="btn icon ghost sm"><Icon.Edit /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarifs */}
          <div className="panel" style={{padding: 18}}>
            <div style={{fontSize: 13, fontWeight: 600, marginBottom: 12}}>Prestations et tarifs</div>
            {[
              { p: 'Consultation généraliste',       a: 250 },
              { p: 'Première consultation',          a: 300 },
              { p: 'Consultation de contrôle court', a: 200 },
              { p: 'Certificat médical',             a: 150 },
              { p: 'Vaccination (hors produit)',     a: 180 },
              { p: 'Prise en charge à domicile',     a: 500 },
            ].map((t,i)=>(
              <div key={i} style={{display:'grid', gridTemplateColumns: '1fr 140px 40px', gap: 10, alignItems:'center', padding: '8px 0', borderBottom: '1px dashed var(--border)'}}>
                <span style={{fontSize: 12.5}}>{t.p}</span>
                <div style={{display:'flex', gap: 4, alignItems:'center'}}>
                  <input className="input tnum sm" defaultValue={t.a.toFixed(2).replace('.', ',')} style={{height: 30, textAlign: 'right'}} />
                  <span style={{fontSize: 11, color: 'var(--ink-3)'}}>MAD</span>
                </div>
                <button className="btn icon ghost sm"><Icon.Trash /></button>
              </div>
            ))}
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap: 8, marginTop: 20, position: 'sticky', bottom: 0, background: 'linear-gradient(to top, var(--bg), transparent)', padding: '12px 0'}}>
            <button className="btn">Annuler</button>
            <button className="btn primary"><Icon.Check /> Enregistrer les modifications</button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

window.Parametrage = Parametrage;
