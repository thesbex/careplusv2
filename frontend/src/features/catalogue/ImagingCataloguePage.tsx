/**
 * Catalogue radio / imagerie — desktop, read-only.
 * Backend only exposes GET /api/catalog/imaging-exams?q=.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Panel } from '@/components/ui/Panel';
import { Search } from '@/components/icons';
import { api } from '@/lib/api/client';
import { CatalogueTabs } from './LabCataloguePage';
import './catalogue-tabs.css';

interface ImagingExam {
  id: string;
  code: string;
  name: string;
  modality: string | null;
}

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

export default function ImagingCataloguePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ImagingExam[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalityFilter, setModalityFilter] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<ImagingExam[]>('/catalog/imaging-exams', {
        params: debouncedQ.trim() ? { q: debouncedQ.trim() } : {},
      })
      .then((r) => setItems(r.data))
      .catch(() => toast.error('Impossible de charger les examens d’imagerie.'))
      .finally(() => setIsLoading(false));
  }, [debouncedQ]);

  const modalities = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.modality) set.add(it.modality);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (modalityFilter ? items.filter((i) => i.modality === modalityFilter) : items),
    [items, modalityFilter],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, ImagingExam[]>();
    for (const it of filtered) {
      const key = it.modality ?? 'Autres';
      const list = m.get(key) ?? [];
      list.push(it);
      m.set(key, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <Screen
      active="catalogue"
      title="Catalogue radio / imagerie"
      sub={`${filtered.length} examen${filtered.length > 1 ? 's' : ''}`}
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <CatalogueTabs active="radio" />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--ink-3)', display: 'flex',
              }}
              aria-hidden="true"
            >
              <Search />
            </span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom ou code…"
              style={{
                width: '100%', height: 36, padding: '0 12px 0 32px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
              aria-label="Rechercher un examen d'imagerie"
            />
          </div>
          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            style={{
              height: 36, padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
            }}
            aria-label="Modalité"
          >
            <option value="">Toutes les modalités</option>
            {modalities.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun examen ne correspond à la recherche.
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th style={{ width: 100 }}>Code</Th>
                  <Th>Nom</Th>
                  <Th style={{ width: 220 }}>Modalité</Th>
                </tr>
              </thead>
              <tbody>
                {grouped.flatMap(([mod, list]) =>
                  list.map((e, idx) => (
                    <tr
                      key={e.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: idx === 0 ? 'var(--bg-alt)' : undefined,
                      }}
                    >
                      <Td className="mono">{e.code}</Td>
                      <Td>{e.name}</Td>
                      <Td style={{ color: 'var(--ink-3)' }}>{idx === 0 ? mod : ''}</Td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </Screen>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: 'left', padding: '10px 14px', fontWeight: 600,
        fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children, style, className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td className={className} style={{ padding: '8px 14px', verticalAlign: 'top', ...style }}>
      {children}
    </td>
  );
}
