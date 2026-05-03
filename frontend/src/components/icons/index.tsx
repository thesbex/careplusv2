/**
 * careplus icon set — 30 icons, 1.5 stroke, 16×16 viewBox, currentColor.
 * Ported from design/prototype/icons.jsx on 2026-04-24.
 *
 * Usage:
 *   import { Calendar, Warn } from '@/components/icons';
 *   <Calendar />  // inherits color from parent
 *
 * Per DESIGN_SYSTEM.md §8: never fill except Dot/status indicators, never import
 * Lucide/Heroicons — re-draw to match existing stroke weights and rounded caps.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Calendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="2" y="3.5" width="12" height="10.5" rx="1.5" />
    <path d="M5 2v3M11 2v3M2 6.5h12" />
  </Base>
);

export const Users = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" />
    <path d="M10.5 4c1.4 0 2.5 1.1 2.5 2.5S11.9 9 10.5 9" />
    <path d="M11 13c0-1.5 1-2.8 2.5-3.4" />
  </Base>
);

export const Waiting = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3l2 1.5" />
  </Base>
);

export const Stetho = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 2v4.5c0 1.5 1.1 2.5 2.5 2.5S9 8 9 6.5V2" />
    <path d="M2.5 2h3M7.5 2h3" />
    <path d="M6.5 9v1.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V9.5" />
    <circle cx="12.5" cy="7.5" r="1.5" />
  </Base>
);

export const Invoice = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1V2z" />
    <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
  </Base>
);

export const Settings = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="1.8" />
    <path d="M8 1.5v1.7M8 12.8v1.7M1.5 8h1.7M12.8 8h1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" />
  </Base>
);

export const Search = (p: IconProps) => (
  <Base {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L13.5 13.5" />
  </Base>
);

export const Plus = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3v10M3 8h10" />
  </Base>
);

export const Bell = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11V7.5c0-2.2 1.8-4 4-4s4 1.8 4 4V11" />
    <path d="M2.5 11h11M7 13.5a1.2 1.2 0 002 0" />
  </Base>
);

export const ChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M9.5 3.5L5 8l4.5 4.5" />
  </Base>
);

export const ChevronRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.5 3.5L11 8l-4.5 4.5" />
  </Base>
);

export const ChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 6l4.5 4.5L12.5 6" />
  </Base>
);

export const ChevronUp = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 10L8 5.5 12.5 10" />
  </Base>
);

export const Close = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Base>
);

export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8.5l3 3L13 4.5" />
  </Base>
);

export const Phone = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 2.5l2 .5L7 6 5.5 7c.8 1.8 1.7 2.7 3.5 3.5L10 9l3 1.5.5 2c-4 1-9-4-10-10z" />
  </Base>
);

export const Print = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6V2h8v4" />
    <rect x="2" y="6" width="12" height="6" rx="1" />
    <path d="M4 10h8v4H4z" />
  </Base>
);

export const Pill = (p: IconProps) => (
  <Base {...p}>
    <rect x="1.5" y="6" width="13" height="4" rx="2" transform="rotate(-30 8 8)" />
    <path d="M5 5l6 6" transform="rotate(-30 8 8)" />
  </Base>
);

export const Flask = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 2h4v3.5l3 6.5a1.5 1.5 0 01-1.4 2H4.4A1.5 1.5 0 013 12l3-6.5V2z" />
    <path d="M6 2h4" />
  </Base>
);

export const Scan = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 5V3h2M12 3h2v2M14 11v2h-2M4 13H2v-2" />
    <path d="M4.5 8h7" />
  </Base>
);

export const Warn = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 2L14 13H2L8 2z" />
    <path d="M8 6.5v3M8 11.2v.1" />
  </Base>
);

export const Heart = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 13.5S2.5 10.5 2.5 6.5a3 3 0 015.5-1.8A3 3 0 0113.5 6.5c0 4-5.5 7-5.5 7z" />
  </Base>
);

export const Thermo = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 2.5a1.5 1.5 0 013 0v7a2.5 2.5 0 11-3 0v-7z" />
    <circle cx="8.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const Clipboard = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="10" height="11" rx="1" />
    <path d="M5.5 3V2a1 1 0 011-1h3a1 1 0 011 1v1" />
    <path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" />
  </Base>
);

export const File = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 2h6l4 4v8H3V2z" />
    <path d="M9 2v4h4" />
  </Base>
);

export const Edit = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 13l1-3 7-7 2 2-7 7-3 1zM10 4l2 2" />
  </Base>
);

export const Trash = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5" />
    <path d="M4.5 4.5L5 13a1 1 0 001 1h4a1 1 0 001-1l.5-8.5" />
  </Base>
);

export const Eye = (p: IconProps) => (
  <Base {...p}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
    <circle cx="8" cy="8" r="2" />
  </Base>
);

export const MoreH = (p: IconProps) => (
  <Base {...p}>
    <circle cx="3.5" cy="8" r={0.8} fill="currentColor" />
    <circle cx="8" cy="8" r={0.8} fill="currentColor" />
    <circle cx="12.5" cy="8" r={0.8} fill="currentColor" />
  </Base>
);

export const Lock = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="7" width="10" height="7" rx="1" />
    <path d="M5 7V5a3 3 0 016 0v2" />
  </Base>
);

export const Logout = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 8h8M11 5l3 3-3 3M10 2H3v12h7" />
  </Base>
);

export const Sun = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" />
  </Base>
);

export const Clock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4v4l2.5 1.5" />
  </Base>
);

export const Doc = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 2h6l4 4v8H3V2z" />
    <path d="M9 2v4h4M5.5 9h5M5.5 11.5h5" />
  </Base>
);

export const Dot = (p: IconProps) => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false" {...p}>
    <circle cx="5" cy="5" r="3.5" fill="currentColor" />
  </svg>
);

export const Menu = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
  </Base>
);

export const Filter = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 3h12l-4.5 5.5V13l-3 1V8.5L2 3z" />
  </Base>
);

export const Signal = (p: IconProps) => (
  <Base {...p}>
    <rect x="2" y="10" width="2" height="4" />
    <rect x="6" y="7" width="2" height="7" />
    <rect x="10" y="4" width="2" height="10" />
  </Base>
);

export const Camera = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 5.5h2l1-1.5h5l1 1.5h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />
    <circle cx="8" cy="9" r="2.5" />
  </Base>
);

export const Upload = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 11V3" />
    <path d="M5 6l3-3 3 3" />
    <path d="M2.5 11.5v1a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" />
  </Base>
);

export const Box = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 5l5.5-2.5L13.5 5v7L8 14.5 2.5 12V5z" />
    <path d="M2.5 5L8 7.5l5.5-2.5" />
    <path d="M8 7.5V14.5" />
  </Base>
);
