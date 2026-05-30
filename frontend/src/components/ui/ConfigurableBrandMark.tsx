/**
 * Marque (logo) configurable de la sidebar — pilotée par l'apparence (V072 /
 * ADR-044, Tweaks « Logo »). 6 concepts au choix + fond + signe, rendus avec
 * les couleurs de l'apparence appliquée. Réactif à l'aperçu : on s'abonne au
 * store d'apparence (applyAppearance notifie à chaque preview/save).
 *
 * Concepts portés du prototype Calm Premium (LOGOS, viewBox 0 0 40 40).
 */
import { useSyncExternalStore } from 'react';
import { getAppliedAppearance, subscribeAppearance, type LogoMark } from '@/lib/theme/appearance';

function MarkGlyph({ mark, fg, accent }: { mark: LogoMark; fg: string; accent: string }) {
  switch (mark) {
    case 'cross':
      return (
        <path
          d="M16 6h8a2 2 0 0 1 2 2v6h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6v6a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-6H8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h6V8a2 2 0 0 1 2-2z"
          fill={fg}
        />
      );
    case 'pulse':
      return (
        <path
          d="M6 22h6l3-7.5 4 13 3-8h4"
          fill="none"
          stroke={fg}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'overlap':
      return (
        <>
          <rect x="16.5" y="6" width="7" height="28" rx="3.5" fill={fg} />
          <rect x="6" y="16.5" width="28" height="7" rx="3.5" fill={accent} opacity="0.8" />
        </>
      );
    case 'mono':
      return (
        <>
          <path d="M27 13.5a9 9 0 1 0 0 13" fill="none" stroke={fg} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M28.5 16.5v7M25 20h7" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'module':
      return (
        <>
          <rect x="16.5" y="6.5" width="7" height="7" rx="2.4" fill={fg} />
          <rect x="16.5" y="16.5" width="7" height="7" rx="2.4" fill={accent} />
          <rect x="16.5" y="26.5" width="7" height="7" rx="2.4" fill={fg} />
          <rect x="6.5" y="16.5" width="7" height="7" rx="2.4" fill={fg} />
          <rect x="26.5" y="16.5" width="7" height="7" rx="2.4" fill={fg} />
        </>
      );
    case 'bloom':
    default:
      return (
        <>
          <rect x="17" y="7" width="6" height="10" rx="3" fill={fg} />
          <rect x="17" y="23" width="6" height="10" rx="3" fill={fg} />
          <rect x="7" y="17" width="10" height="6" rx="3" fill={fg} />
          <rect x="23" y="17" width="10" height="6" rx="3" fill={fg} />
          <circle cx="20" cy="20" r="2.7" fill={accent} />
        </>
      );
  }
}

export function ConfigurableBrandMark({ size = 32 }: { size?: number }) {
  const a = useSyncExternalStore(subscribeAppearance, getAppliedAppearance, getAppliedAppearance);
  // Sur fond clair (logo blanc), une hairline garde la tuile visible.
  const lightBg = a.logoBg.toLowerCase() === '#ffffff' || a.logoBg.toLowerCase() === '#fff';
  return (
    <div
      className="cp-brand-mark"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 9,
        background: a.logoBg,
        border: lightBg ? '1px solid var(--border)' : 'none',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(20, 30, 50, 0.18)',
      }}
    >
      <svg width={size - 12} height={size - 12} viewBox="0 0 40 40" fill="none" style={{ display: 'block' }}>
        <MarkGlyph mark={a.logo} fg={a.logoFg} accent={a.accent} />
      </svg>
    </div>
  );
}
