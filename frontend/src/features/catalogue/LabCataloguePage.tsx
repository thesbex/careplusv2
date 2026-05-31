/**
 * Catalogue analyses biologiques — desktop.
 *
 * Endpoints :
 *   GET    /api/catalog/lab-tests?q=
 *   POST   /api/catalog/lab-tests              (MEDECIN/ADMIN)
 *   PUT    /api/catalog/lab-tests/{id}         (MEDECIN/ADMIN)
 *   DELETE /api/catalog/lab-tests/{id}         (MEDECIN/ADMIN)
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Plus, Search, Trash } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { CatalogImportButton } from './components/CatalogImportButton';
import './catalogue-tabs.css';

interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string | null;
  internalPrice: number | null;
}

interface Form {
  code: string;
  name: string;
  category: string;
  /** Texte côté form, parsé en number à l'envoi. Vide = NULL → non facturable interne. */
  internalPrice: string;
}

const EMPTY_FORM: Form = { code: '', name: '', category: '', internalPrice: '' };

const NAV_MAP = {
  dashboard: '/dashboard',
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  grossesses: '/grossesses',
  stock: '/stock',
  queueLab: '/queue/lab',
  queueRadio: '/queue/radio',
  messages: '/messages',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

export default function LabCataloguePage() {
  const navigate = useNavigate();
  const { t: tr } = useT();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');
  const [items, setItems] = useState<LabTest[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      .catch(() => toast.error(tr('cat.lab.loadError')))
      .finally(() => setIsLoading(false));
  }, [debouncedQ, refreshTick, tr]);

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
      const key = it.category ?? tr('cat.other');
      const list = m.get(key) ?? [];
      list.push(it);
      m.set(key, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, tr]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(t: LabTest) {
    setEditingId(t.id);
    setForm({
      code: t.code,
      name: t.name,
      category: t.category ?? '',
      internalPrice: t.internalPrice != null ? String(t.internalPrice) : '',
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error(tr('cat.lab.required'));
      return;
    }
    const internalPrice = form.internalPrice.trim();
    let parsedPrice: number | null = null;
    if (internalPrice) {
      const n = Number(internalPrice.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        toast.error(tr('cat.price.invalid'));
        return;
      }
      parsedPrice = n;
    }
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || null,
        internalPrice: parsedPrice,
      };
      if (editingId) {
        await api.put(`/catalog/lab-tests/${editingId}`, body);
        toast.success(tr('cat.lab.updated'));
      } else {
        await api.post('/catalog/lab-tests', body);
        toast.success(tr('cat.lab.added'));
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e.response?.status === 409) {
        toast.error(tr('cat.code.taken'));
      } else if (e.response?.status === 403) {
        toast.error(tr('cat.permissionDenied'));
      } else {
        toast.error(tr('cat.saveError'));
      }
    }
  }

  async function handleDelete(t: LabTest) {
    if (!confirm(tr('cat.lab.confirmDeactivate', { name: t.name }))) return;
    try {
      await api.delete(`/catalog/lab-tests/${t.id}`);
      toast.success(tr('cat.lab.deactivated'));
      setItems((xs) => xs.filter((x) => x.id !== t.id));
    } catch {
      toast.error(tr('cat.deleteError'));
    }
  }

  return (
    <Screen
      active="catalogue"
      title={tr('cat.lab.title')}
      sub={tr(filtered.length > 1 ? 'cat.lab.sub_plural' : 'cat.lab.sub', { n: filtered.length })}
      topbarRight={
        canEdit ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <CatalogImportButton kind="lab" onImported={() => setRefreshTick((t) => t + 1)} />
            <Button variant="primary" onClick={openCreate}>
              <Plus /> {tr('cat.add')}
            </Button>
          </div>
        ) : undefined
      }
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
              placeholder={tr('cat.lab.searchPlaceholder')}
              style={{
                width: '100%', height: 36, padding: '0 12px 0 32px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
              aria-label={tr('cat.lab.searchAria')}
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
            aria-label={tr('cat.lab.categoryAria')}
          >
            <option value="">{tr('cat.lab.allCategories')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{tr('common.loading')}</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              {tr('cat.lab.empty')}
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th style={{ width: 100 }}>{tr('cat.lab.col.code')}</Th>
                  <Th>{tr('cat.lab.col.name')}</Th>
                  <Th style={{ width: 220 }}>{tr('cat.lab.col.category')}</Th>
                  <Th style={{ width: 130, textAlign: 'right' }}>{tr('cat.lab.col.internalPrice')}</Th>
                  {canEdit && <Th style={{ width: 110 }}> </Th>}
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
                      <Td style={{ textAlign: 'right' }}>{formatInternalPrice(t.internalPrice)}</Td>
                      {canEdit && (
                        <Td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              style={btnLink}
                            >
                              {tr('common.edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDelete(t); }}
                              aria-label={tr('cat.lab.deleteAria', { name: t.name })}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--danger)', padding: 4, lineHeight: 0,
                              }}
                            >
                              <Trash />
                            </button>
                          </div>
                        </Td>
                      )}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(20,18,12,0.45)', zIndex: 100,
            display: 'flex', justifyContent: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div
            style={{
              width: 'min(480px, 92vw)', height: '100%',
              background: 'var(--surface)', boxShadow: '-16px 0 40px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? tr('cat.lab.drawer.edit') : tr('cat.lab.drawer.new')}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}
                aria-label={tr('common.close')}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <Field label={tr('cat.lab.field.code')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder={tr('cat.lab.field.code.ph')} hint={tr('cat.lab.field.code.hint')} />
              <Field label={tr('cat.lab.field.name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder={tr('cat.lab.field.name.ph')} />
              <Field label={tr('cat.lab.field.category')} value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder={tr('cat.lab.field.category.ph')} />
              <Field
                label={tr('cat.lab.field.internalPrice')}
                value={form.internalPrice}
                onChange={(v) => setForm({ ...form, internalPrice: v })}
                placeholder={tr('cat.lab.field.internalPrice.ph')}
                hint={tr('cat.lab.field.internalPrice.hint')}
              />
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>{tr('common.cancel')}</Button>
              <Button type="button" variant="primary" onClick={() => { void handleSave(); }}>
                {editingId ? tr('cat.lab.submit.edit') : tr('cat.lab.submit.new')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export function CatalogueTabs({ active }: { active: 'medicaments' | 'analyses' | 'radio' }) {
  const navigate = useNavigate();
  const { t: tr } = useT();
  const tabs: { id: 'medicaments' | 'analyses' | 'radio'; label: string; path: string }[] = [
    { id: 'medicaments', label: tr('cat.tab.medicaments'), path: '/catalogue' },
    { id: 'analyses', label: tr('cat.tab.analyses'), path: '/catalogue/analyses' },
    { id: 'radio', label: tr('cat.tab.radio'), path: '/catalogue/radio' },
  ];
  return (
    <div className="cat-tabs" role="tablist" aria-label={tr('cat.tabsAria')}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`cat-tab${active === tab.id ? ' on' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11.5, padding: '4px 8px', borderRadius: 4,
  color: 'var(--primary)', fontFamily: 'inherit',
};

/**
 * Rend la colonne « Prix interne » du catalogue analyses / radio. Un prix NULL
 * = analyse non facturée en interne → affiché en gris pour que l'admin
 * repère d'un coup d'œil ce qu'il reste à tarifer (R030 / V050).
 */
export function formatInternalPrice(price: number | null): React.ReactNode {
  if (price == null) {
    return <span style={{ color: 'var(--ink-3)' }}>—</span>;
  }
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{price.toLocaleString('fr-FR')} MAD</span>;
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

function Field({
  label, value, onChange, placeholder, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 34, padding: '0 10px',
          border: '1px solid var(--border)', borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13,
          background: 'var(--surface)',
        }}
      />
      {hint && (
        <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{hint}</span>
      )}
    </label>
  );
}
