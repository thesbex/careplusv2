/**
 * Catalogue médicaments — mobile.
 * Search-and-tap. Read-only on mobile (creation/edit lives on desktop —
 * the form is dense and admin-only).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Search } from '@/components/icons';
import { api } from '@/lib/api/client';

interface Medication {
  id: string;
  commercialName: string;
  dci: string;
  form: string;
  dosage: string;
  tags: string | null;
  favorite: boolean;
  active: boolean;
}

export default function CatalogueMobilePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Medication[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void api.get<string[]>('/catalog/medications/tags').then((r) => setTags(r.data));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const params: Record<string, string> = { limit: '500' };
    if (debouncedQ.trim()) params.q = debouncedQ.trim();
    if (tagFilter) params.tag = tagFilter;
    api
      .get<Medication[]>('/catalog/medications/browse', { params })
      .then((r) => setItems(r.data))
      .catch(() => toast.error('Impossible de charger le catalogue.'))
      .finally(() => setIsLoading(false));
  }, [debouncedQ, tagFilter]);

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
          title="Catalogue"
          sub={`${items.length} entrée${items.length > 1 ? 's' : ''}`}
        />
      }
    >
      <div className="mb-pad">
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink-3)',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <Search />
          </span>
          <input
            type="search"
            className="m-input"
            placeholder="Rechercher par nom commercial ou DCI…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher un médicament"
            style={{ paddingLeft: 36 }}
          />
        </div>

        {/* Tag filter */}
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="m-input"
          aria-label="Classe pharmacologique"
          style={{ marginBottom: 14 }}
        >
          <option value="">Toutes les classes</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* List */}
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
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              Aucun médicament ne correspond.
            </div>
          ) : (
            items.map((m, i) => (
              <div
                key={m.id}
                className="m-row"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                }}
              >
                <div className="m-row-pri">
                  <div
                    className="m-row-main"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {m.favorite && (
                      <span
                        style={{ color: 'var(--amber)', fontSize: 13 }}
                        aria-label="Favori"
                      >
                        ★
                      </span>
                    )}
                    {m.commercialName}
                  </div>
                  <div className="m-row-sub">
                    {m.dci} · {m.form} · <span className="tnum">{m.dosage}</span>
                    {m.tags ? ` · ${m.tags}` : ''}
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
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          La gestion du catalogue (ajout / modification) se fait depuis la version
          desktop par un médecin ou un administrateur.
        </div>
      </div>
    </MScreen>
  );
}
