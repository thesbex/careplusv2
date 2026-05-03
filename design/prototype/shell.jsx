// Shared shell: sidebar + topbar. Used by every careplus screen.

function Sidebar({ active = 'agenda', counts = {} }) {
  const items = [
    { id: 'agenda',     label: "Agenda",           icon: 'Calendar' },
    { id: 'patients',   label: 'Patients',         icon: 'Users' },
    { id: 'salle',      label: "Salle d'attente",  icon: 'Waiting', badge: counts.salle },
    { id: 'consult',    label: 'Consultations',    icon: 'Stetho' },
    { id: 'factu',      label: 'Facturation',      icon: 'Invoice' },
    { id: 'params',     label: 'Paramètres',       icon: 'Settings' },
  ];
  return (
    <aside className="cp-sidebar">
      <div className="cp-brand">
        <div className="cp-brand-mark">c</div>
        <div>
          <div className="cp-brand-name">careplus</div>
          <div className="cp-brand-cab">Cab. El Amrani · Casablanca</div>
        </div>
      </div>

      <div className="cp-nav-section">Flux patient</div>
      {items.slice(0, 5).map(it => {
        const Ico = Icon[it.icon];
        return (
          <div key={it.id} className={`cp-nav-item ${active === it.id ? 'active' : ''}`}>
            <span className="ico"><Ico /></span>
            <span>{it.label}</span>
            {it.badge ? <span className="cp-nav-badge">{it.badge}</span> : null}
          </div>
        );
      })}

      <div className="cp-nav-section">Configuration</div>
      {items.slice(5).map(it => {
        const Ico = Icon[it.icon];
        return (
          <div key={it.id} className={`cp-nav-item ${active === it.id ? 'active' : ''}`}>
            <span className="ico"><Ico /></span>
            <span>{it.label}</span>
          </div>
        );
      })}

      <div className="cp-user-chip">
        <div className="cp-avatar">FB</div>
        <div style={{minWidth: 0, flex: 1}}>
          <div className="cp-user-name">Fatima Z. Benjelloun</div>
          <div className="cp-user-role">Secrétaire</div>
        </div>
        <span style={{color: 'var(--ink-4)'}}><Icon.ChevronDown /></span>
      </div>
    </aside>
  );
}

function Topbar({ title, sub, showSearch = true, right, pageDate }) {
  return (
    <header className="cp-topbar">
      <div style={{display:'flex', alignItems:'baseline', gap: 12}}>
        <div className="cp-topbar-title">{title}</div>
        {sub ? <div className="cp-topbar-sub">{sub}</div> : null}
      </div>
      {showSearch && (
        <div className="cp-search">
          <Icon.Search />
          <span>Rechercher un patient par nom, téléphone, CIN…</span>
          <span className="kbd">⌘ K</span>
        </div>
      )}
      <div className="cp-topbar-right">
        {pageDate && (
          <div className="tnum" style={{fontSize: 12, color: 'var(--ink-3)', padding: '0 4px'}}>
            {pageDate}
          </div>
        )}
        <button className="btn icon ghost" title="Notifications"><Icon.Bell /></button>
        {right}
      </div>
    </header>
  );
}

// Simple screen frame used to compose <Sidebar /> + <Topbar /> + content
function Screen({ active, title, sub, topbarRight, pageDate, right, children, counts }) {
  return (
    <div className="cp-app">
      <Sidebar active={active} counts={counts || {salle: 3}} />
      <div className="cp-main">
        <Topbar title={title} sub={sub} right={topbarRight} pageDate={pageDate} />
        <div className="cp-content">
          <div className="cp-workspace">{children}</div>
          {right && <div className="cp-rightpanel">{right}</div>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, Screen });
