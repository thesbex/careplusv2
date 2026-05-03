import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '@/lib/api/client';
import { Search } from '@/components/icons';

/**
 * Topbar global patient search ("spotlight"). Opens via the .cp-search button
 * or the ⌘K / Ctrl+K shortcut, hits GET /api/patients?q=..., and navigates to
 * the dossier on selection.
 *
 * Why this exists: the .cp-search button was visible for the whole sprint with
 * no handler, so clicking it did nothing — worse than absent. This makes the
 * affordance match the visual.
 */

interface PatientHit {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  cin: string | null;
  birthDate: string | null;
}

interface Page<T> { content: T[] }

function ageOf(birth: string | null): string {
  if (!birth) return '';
  const d = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() - d.getMonth() < 0 || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return `${age} ans`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientSearchSpotlight({ open, onOpenChange }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<PatientHit[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Reset query when the spotlight closes so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setQ('');
      setActive(0);
      setResults([]);
    }
  }, [open]);

  // Debounced fetch — avoid both useQuery (would force a QueryClientProvider
  // on tests that just render <Screen />) and useNavigate (same reason for
  // BrowserRouter). Spotlight is shell-level, so its deps stay shell-level.
  const trimmed = q.trim();
  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setIsFetching(true);
      try {
        const r = await api.get<Page<PatientHit>>(
          `/patients?q=${encodeURIComponent(trimmed)}&size=8`,
        );
        if (!cancelled) setResults(r.data.content);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmed, open]);

  function pick(p: PatientHit) {
    onOpenChange(false);
    // Full reload navigation — keeps Spotlight free of Router context so it
    // can mount inside Screen (which renders inside <Routes>) without test
    // wrappers. UX cost is minimal: dossier loads from a fresh paint.
    window.location.assign(`/patients/${p.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) pick(hit);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 80,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '15vh',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(620px, 92vw)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
            zIndex: 81,
            overflow: 'hidden',
          }}
        >
          <Dialog.Title style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Rechercher un patient
          </Dialog.Title>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: 'var(--ink-3)', display: 'flex' }}><Search /></span>
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Nom, téléphone, CIN…"
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 15,
                fontFamily: 'inherit',
                background: 'transparent',
                color: 'var(--ink)',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Esc pour fermer</span>
          </div>
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            {trimmed.length < 2 && (
              <div style={{ padding: 18, fontSize: 12.5, color: 'var(--ink-3)' }}>
                Tapez au moins 2 caractères pour lancer la recherche.
              </div>
            )}
            {trimmed.length >= 2 && isFetching && results.length === 0 && (
              <div style={{ padding: 18, fontSize: 12.5, color: 'var(--ink-3)' }}>
                Recherche en cours…
              </div>
            )}
            {trimmed.length >= 2 && !isFetching && results.length === 0 && (
              <div style={{ padding: 18, fontSize: 12.5, color: 'var(--ink-3)' }}>
                Aucun patient trouvé pour « {trimmed} ».
              </div>
            )}
            {results.map((p, i) => {
              const isActive = i === active;
              const tags = [ageOf(p.birthDate), p.cin, p.phone].filter(Boolean).join(' · ');
              return (
                <button
                  type="button"
                  key={p.id}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: isActive ? 'var(--primary-soft)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    color: 'var(--ink)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 550, lineHeight: 1.2 }}>
                      {p.firstName} {p.lastName}
                    </div>
                    {tags && (
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{tags}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>↵</span>
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
