// Minimal stroked icons for careplus — 1.5 stroke, 16x16 viewBox, currentColor
const Ic = {
  base: (d, extra) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {typeof d === 'string' ? <path d={d} /> : d}
      {extra}
    </svg>
  ),
};

const Icon = {
  Calendar: () => Ic.base(null,
    <>
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
      <path d="M5 2v3M11 2v3M2 6.5h12" />
    </>
  ),
  Users: () => Ic.base(null,
    <>
      <circle cx="6" cy="6" r="2.5" />
      <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <path d="M10.5 4c1.4 0 2.5 1.1 2.5 2.5S11.9 9 10.5 9" />
      <path d="M11 13c0-1.5 1-2.8 2.5-3.4" />
    </>
  ),
  Waiting: () => Ic.base(null,
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3l2 1.5" />
    </>
  ),
  Stetho: () => Ic.base(null,
    <>
      <path d="M4 2v4.5c0 1.5 1.1 2.5 2.5 2.5S9 8 9 6.5V2" />
      <path d="M2.5 2h3M7.5 2h3" />
      <path d="M6.5 9v1.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V9.5" />
      <circle cx="12.5" cy="7.5" r="1.5" />
    </>
  ),
  Invoice: () => Ic.base(null,
    <>
      <path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1V2z" />
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
    </>
  ),
  Settings: () => Ic.base(null,
    <>
      <circle cx="8" cy="8" r="1.8" />
      <path d="M8 1.5v1.7M8 12.8v1.7M1.5 8h1.7M12.8 8h1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" />
    </>
  ),
  Search: () => Ic.base(null,
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L13.5 13.5" />
    </>
  ),
  Plus: () => Ic.base("M8 3v10M3 8h10"),
  Bell: () => Ic.base(null,
    <>
      <path d="M4 11V7.5c0-2.2 1.8-4 4-4s4 1.8 4 4V11" />
      <path d="M2.5 11h11M7 13.5a1.2 1.2 0 002 0" />
    </>
  ),
  ChevronLeft: () => Ic.base("M9.5 3.5L5 8l4.5 4.5"),
  ChevronRight: () => Ic.base("M6.5 3.5L11 8l-4.5 4.5"),
  ChevronDown: () => Ic.base("M3.5 6l4.5 4.5L12.5 6"),
  ChevronUp: () => Ic.base("M3.5 10L8 5.5 12.5 10"),
  Close: () => Ic.base("M4 4l8 8M12 4l-8 8"),
  Check: () => Ic.base("M3 8.5l3 3L13 4.5"),
  Phone: () => Ic.base("M3.5 2.5l2 .5L7 6 5.5 7c.8 1.8 1.7 2.7 3.5 3.5L10 9l3 1.5.5 2c-4 1-9-4-10-10z"),
  Print: () => Ic.base(null,
    <>
      <path d="M4 6V2h8v4" />
      <rect x="2" y="6" width="12" height="6" rx="1" />
      <path d="M4 10h8v4H4z" />
    </>
  ),
  Pill: () => Ic.base(null,
    <>
      <rect x="1.5" y="6" width="13" height="4" rx="2" transform="rotate(-30 8 8)" />
      <path d="M5 5l6 6" transform="rotate(-30 8 8)" />
    </>
  ),
  Flask: () => Ic.base(null,
    <>
      <path d="M6 2h4v3.5l3 6.5a1.5 1.5 0 01-1.4 2H4.4A1.5 1.5 0 013 12l3-6.5V2z" />
      <path d="M6 2h4" />
    </>
  ),
  Scan: () => Ic.base(null,
    <>
      <path d="M2 5V3h2M12 3h2v2M14 11v2h-2M4 13H2v-2" />
      <path d="M4.5 8h7" />
    </>
  ),
  Warn: () => Ic.base(null,
    <>
      <path d="M8 2L14 13H2L8 2z" />
      <path d="M8 6.5v3M8 11.2v.1" />
    </>
  ),
  Heart: () => Ic.base("M8 13.5S2.5 10.5 2.5 6.5a3 3 0 015.5-1.8A3 3 0 0113.5 6.5c0 4-5.5 7-5.5 7z"),
  Thermo: () => Ic.base(null,
    <>
      <path d="M7 2.5a1.5 1.5 0 013 0v7a2.5 2.5 0 11-3 0v-7z" />
      <circle cx="8.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  Clipboard: () => Ic.base(null,
    <>
      <rect x="3" y="3" width="10" height="11" rx="1" />
      <path d="M5.5 3V2a1 1 0 011-1h3a1 1 0 011 1v1" />
      <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" />
    </>
  ),
  File: () => Ic.base(null,
    <>
      <path d="M3 2h6l4 4v8H3V2z" />
      <path d="M9 2v4h4" />
    </>
  ),
  Edit: () => Ic.base("M3 13l1-3 7-7 2 2-7 7-3 1zM10 4l2 2"),
  Trash: () => Ic.base(null,
    <>
      <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5" />
      <path d="M4.5 4.5L5 13a1 1 0 001 1h4a1 1 0 001-1l.5-8.5" />
    </>
  ),
  Eye: () => Ic.base(null,
    <>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  MoreH: () => Ic.base(null,
    <>
      <circle cx="3.5" cy="8" r=".8" fill="currentColor" />
      <circle cx="8" cy="8" r=".8" fill="currentColor" />
      <circle cx="12.5" cy="8" r=".8" fill="currentColor" />
    </>
  ),
  Lock: () => Ic.base(null,
    <>
      <rect x="3" y="7" width="10" height="7" rx="1" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </>
  ),
  Logout: () => Ic.base("M6 8h8M11 5l3 3-3 3M10 2H3v12h7"),
  Sun: () => Ic.base(null,
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
    </>
  ),
  Clock: () => Ic.base(null,
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l2.5 1.5" />
    </>
  ),
  Doc: () => Ic.base(null,
    <>
      <path d="M3 2h6l4 4v8H3V2z" />
      <path d="M9 2v4h4M5.5 9h5M5.5 11.5h5" />
    </>
  ),
  Dot: () => (
    <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5" fill="currentColor"/></svg>
  ),
  Menu: () => Ic.base("M2.5 4h11M2.5 8h11M2.5 12h11"),
  Filter: () => Ic.base("M2 3h12l-4.5 5.5V13l-3 1V8.5L2 3z"),
  Signal: () => Ic.base(null,
    <>
      <rect x="2" y="10" width="2" height="4" />
      <rect x="6" y="7" width="2" height="7" />
      <rect x="10" y="4" width="2" height="10" />
    </>
  ),
};

window.Icon = Icon;
