// Mobile shell: topbar, bottom tab bar, phone-frame wrapper

function MTopbar({ title, sub, left, right, brand }) {
  return (
    <div className="mt">
      {brand ? (
        <div className="mt-brand">
          <div className="cp-brand-mark">c</div>
          <span className="mt-brand-name">careplus</span>
        </div>
      ) : left ? left : null}
      <div style={{flex: 1, minWidth: 0, marginLeft: left || brand ? 0 : 0}}>
        <div className="mt-title">{title}</div>
        {sub ? <div className="mt-sub">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

function MIconBtn({ icon, onClick, badge }) {
  const Ico = Icon[icon];
  return (
    <button className="mt-icon" onClick={onClick} style={{position: 'relative', border: 0, background: 'transparent', cursor: 'pointer'}}>
      <Ico />
      {badge ? (
        <span style={{
          position: 'absolute', top: 6, right: 6, width: 8, height: 8,
          background: 'var(--amber)', borderRadius: '50%', border: '1.5px solid var(--surface)',
        }}/>
      ) : null}
    </button>
  );
}

function MTabs({ active = 'agenda', badges = {} }) {
  const items = [
    { id: 'agenda',   label: 'Agenda',    icon: 'Calendar' },
    { id: 'salle',    label: 'Salle',     icon: 'Waiting', badge: badges.salle },
    { id: 'patients', label: 'Patients',  icon: 'Users' },
    { id: 'factu',    label: 'Factures',  icon: 'Invoice' },
    { id: 'menu',     label: 'Plus',      icon: 'Menu' },
  ];
  return (
    <div className="mtabs">
      {items.map(it => {
        const Ico = Icon[it.icon];
        return (
          <div key={it.id} className={`mtab ${active === it.id ? 'on' : ''}`}>
            <Ico />
            <span>{it.label}</span>
            {it.badge ? <span className="mtab-badge">{it.badge}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function MScreen({ tab = 'agenda', badges = {salle: 3}, topbar, children, fab, noTabs, scrollPad = true }) {
  return (
    <div className="cp-mobile cp-app">
      {topbar}
      <div className="mb scroll">
        {children}
      </div>
      {fab}
      {!noTabs && <MTabs active={tab} badges={badges} />}
    </div>
  );
}

Object.assign(window, { MScreen, MTopbar, MIconBtn, MTabs });
