/**
 * Catalogue analyses biologiques — mobile, read-only.
 * Mirrors CataloguePage.mobile (medications) — search + category filter + list.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Search } from '@/components/icons';
import { api } from '@/lib/api/client';

interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

export default function LabCatalogueMobilePage() {
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

  const filtered = categoryFilter
    ? items.filter((i) => i.category === categoryFilter)
    : items;

  return (
    <MScreen
      tab="menu"
      noTabs
      onTabChange={() => undefined}
      topbar={
        <MTopbar
          left={
            <MIconBtn
              icon="ChevronLeft"
              label="Retour"
              onClick={() => navigate('/parametres')}
            />
          }
          title="Analyses"
          sub={`${filtered.length} entrée${filtered.length > 1 ? 's' : ''}`}
        />
      }
    >
      <div className="mb-pad">
        <label className="m-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder="Rechercher par nom ou code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher une analyse"
            style={{
              flex: 1,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 14,
              color: 'var(--ink)',
            }}
          />
        </label>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="m-input"
          aria-label="Catégorie d'analyse"
          style={{ marginBottom: 14 }}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="m-card">
          {isLoading ? (
            <div
              style={{
                padding: 20,
                color: 'var(--ink-3)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              Aucune analyse ne correspond.
            </div>
          ) : (
            filtered.map((t) => (
              <div key={t.id} className="m-row">
                <div className="m-row-pri">
                  <div className="m-row-main">{t.name}</div>
                  <div className="m-row-sub">
                    <span className="mono">{t.code}</span>
                    {t.category ? ` · ${t.category}` : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--bg-alt)',
            borderRadius: 'var(--r-lg)',
            fontSize: 12,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          Référentiel en lecture seule. La gestion (ajout, désactivation) sera
          activée dès que le backend l’expose.
        </div>
      </div>
    </MScreen>
  );
}
