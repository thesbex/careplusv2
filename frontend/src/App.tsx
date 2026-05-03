/**
 * careplus — app shell.
 * Currently renders the Login screen only (no Router yet — J2 wires the real router + auth guards).
 * A dev-only screen picker in the top-right lets you navigate the ported screens as they ship.
 */
import { useState } from 'react';
import LoginPage from '@/features/login/LoginPage';

type ScreenKey = 'login';

const SCREENS: { key: ScreenKey; label: string }[] = [{ key: 'login', label: '12 · Login' }];

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>('login');

  return (
    <>
      {screen === 'login' && <LoginPage />}

      {/* Dev screen picker (removed in J2 when Router replaces it) */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 9999,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: '6px 8px',
          fontSize: 11,
          fontFamily: 'var(--font-sans)',
          color: 'var(--ink-3)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>careplus</span>
        <span>·</span>
        <select
          value={screen}
          onChange={(e) => setScreen(e.target.value as ScreenKey)}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 4px',
            fontSize: 11,
            fontFamily: 'var(--font-sans)',
            background: 'var(--surface)',
            color: 'var(--ink-2)',
          }}
        >
          {SCREENS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
