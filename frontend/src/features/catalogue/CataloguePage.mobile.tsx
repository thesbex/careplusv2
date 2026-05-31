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
import { Select } from '@/components/ui/Input';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

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
  const { t: tr } = useT();
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
      .catch(() => toast.error(tr('cat.med.loadError')))
      .finally(() => setIsLoading(false));
  }, [debouncedQ, tagFilter, tr]);

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
              label={tr('cat.back')}
              onClick={() => navigate('/parametres')}
            />
          }
          title={tr('cat.mobile.medTitle')}
          sub={tr(items.length > 1 ? 'cat.mobile.sub_plural' : 'cat.mobile.sub', { n: items.length })}
        />
      }
    >
      <div className="mb-pad">
        {/* Search */}
        <label className="m-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder={tr('cat.med.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={tr('cat.med.searchAria')}
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

        {/* Tag filter */}
        <Select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="m-input"
          aria-label={tr('cat.med.classAria')}
          style={{ marginBottom: 14 }}
        >
          <option value="">{tr('cat.med.allClasses')}</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>

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
              {tr('common.loading')}
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
              {tr('cat.med.emptyShort')}
            </div>
          ) : (
            items.map((m) => (
              <div key={m.id} className="m-row">
                <div className="m-row-pri">
                  <div
                    className="m-row-main"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {m.commercialName}
                    {m.favorite && (
                      <span
                        className="m-pill"
                        aria-label={tr('cat.med.favoriteRowAria')}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          background: 'var(--amber-soft)',
                          color: 'var(--amber)',
                        }}
                      >
                        {tr('cat.med.favoritePill')}
                      </span>
                    )}
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
            borderRadius: 'var(--r-lg)',
            fontSize: 12,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          {tr('cat.mobile.medManageNote')}
        </div>
      </div>
    </MScreen>
  );
}
