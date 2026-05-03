/**
 * Catalogue radio / imagerie — mobile, read-only.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Search } from '@/components/icons';
import { api } from '@/lib/api/client';

interface ImagingExam {
  id: string;
  code: string;
  name: string;
  modality: string | null;
}

export default function ImagingCatalogueMobilePage() {
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

  const filtered = modalityFilter
    ? items.filter((i) => i.modality === modalityFilter)
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
          title="Radio / Imagerie"
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
            aria-label="Rechercher un examen d'imagerie"
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
          value={modalityFilter}
          onChange={(e) => setModalityFilter(e.target.value)}
          className="m-input"
          aria-label="Modalité"
          style={{ marginBottom: 14 }}
        >
          <option value="">Toutes les modalités</option>
          {modalities.map((m) => (
            <option key={m} value={m}>
              {m}
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
              Aucun examen ne correspond.
            </div>
          ) : (
            filtered.map((e) => (
              <div key={e.id} className="m-row">
                <div className="m-row-pri">
                  <div className="m-row-main">{e.name}</div>
                  <div className="m-row-sub">
                    <span className="mono">{e.code}</span>
                    {e.modality ? ` · ${e.modality}` : ''}
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
