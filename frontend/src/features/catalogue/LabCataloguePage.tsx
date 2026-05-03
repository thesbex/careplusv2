/**
 * Catalogue analyses biologiques — desktop, read-only.
 *
 * Backend only exposes GET /api/catalog/lab-tests?q= (no CRUD yet).
 * UI : recherche + filtre par catégorie (dérivé localement des résultats).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Panel } from '@/components/ui/Panel';
import { Search } from '@/components/icons';
import { api } from '@/lib/api/client';
import './catalogue-tabs.css';

interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string | null;
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

export default function LabCataloguePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LabTest[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<LabTest[]>('/catalog/lab-tests', {
        params: debouncedQ.trim() ? { q: debouncedQ.trim() } : {},
      })
      .then((r) => setItems(r.data))
      .catch(() => toast.error('Impossible de charger les analyses.'))
      .finally(() => setIsLoading(false));
  }, [debouncedQ]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (categoryFilter ? items.filter((i) => i.category === categoryFilter) : items),
    [items, categoryFilter],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, LabTest[]>();
    for (const it of filtered) {
      const key = it.category ?? 'Autres';
      const list = m.get(key) ?? [];
      list.push(it);
      m.set(key, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <Screen
      active="catalogue"
      title="Catalogue analyses"
      sub={`${filtered.length} analyse${filtered.length > 1 ? 's' : ''}`}
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <CatalogueTabs active="analyses" />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Filtres */}
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
              aria-label="Rechercher une analyse"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              height: 36, padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
            }}
            aria-label="Catégorie d'analyse"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              Aucune analyse ne correspond à la recherche.
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th style={{ width: 100 }}>Code</Th>
                  <Th>Nom</Th>
                  <Th style={{ width: 220 }}>Catégorie</Th>
                </tr>
              </thead>
              <tbody>
                {grouped.flatMap(([cat, list]) =>
                  list.map((t, idx) => (
                    <tr
                      key={t.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: idx === 0 ? 'var(--bg-alt)' : undefined,
                      }}
                    >
                      <Td className="mono">{t.code}</Td>
                      <Td>{t.name}</Td>
                      <Td style={{ color: 'var(--ink-3)' }}>{idx === 0 ? cat : ''}</Td>
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

export function CatalogueTabs({ active }: { active: 'medicaments' | 'analyses' | 'radio' }) {
  const navigate = useNavigate();
  const tabs: { id: 'medicaments' | 'analyses' | 'radio'; label: string; path: string }[] = [
    { id: 'medicaments', label: 'Médicaments', path: '/catalogue' },
    { id: 'analyses', label: 'Analyses', path: '/catalogue/analyses' },
    { id: 'radio', label: 'Radio / Imagerie', path: '/catalogue/radio' },
  ];
  return (
    <div className="cat-tabs" role="tablist" aria-label="Catalogues">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`cat-tab${active === t.id ? ' on' : ''}`}
          onClick={() => navigate(t.path)}
        >
          {t.label}
        </button>
      ))}
    </div>
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
