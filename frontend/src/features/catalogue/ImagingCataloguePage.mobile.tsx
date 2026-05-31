/**
 * Catalogue radio / imagerie — mobile, read-only.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Search } from '@/components/icons';
import { Select } from '@/components/ui/Input';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

interface ImagingExam {
  id: string;
  code: string;
  name: string;
  modality: string | null;
}

export default function ImagingCatalogueMobilePage() {
  const navigate = useNavigate();
  const { t: tr } = useT();
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
      .catch(() => toast.error(tr('cat.img.loadError')))
      .finally(() => setIsLoading(false));
  }, [debouncedQ, tr]);

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
              label={tr('cat.back')}
              onClick={() => navigate('/parametres')}
            />
          }
          title={tr('cat.mobile.imgTitle')}
          sub={tr(filtered.length > 1 ? 'cat.mobile.sub_plural' : 'cat.mobile.sub', { n: filtered.length })}
        />
      }
    >
      <div className="mb-pad">
        <label className="m-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            placeholder={tr('cat.img.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={tr('cat.img.searchAria')}
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

        <Select
          value={modalityFilter}
          onChange={(e) => setModalityFilter(e.target.value)}
          className="m-input"
          aria-label={tr('cat.img.modalityAria')}
          style={{ marginBottom: 14 }}
        >
          <option value="">{tr('cat.img.allModalities')}</option>
          {modalities.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

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
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              {tr('cat.img.emptyShort')}
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
          {tr('cat.mobile.readonlyNote')}
        </div>
      </div>
    </MScreen>
  );
}
