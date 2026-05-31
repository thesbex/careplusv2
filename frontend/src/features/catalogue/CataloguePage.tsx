/**
 * Screen — Catalogue médicaments.
 * Affiche le référentiel commercial-Maroc (V011), avec recherche
 * plein-texte, filtre par classe pharmacologique et CRUD admin.
 *
 * Endpoints :
 *   GET    /api/catalog/medications/browse?q=&tag=&limit=
 *   GET    /api/catalog/medications/tags
 *   POST   /api/catalog/medications              (MEDECIN/ADMIN)
 *   PUT    /api/catalog/medications/{id}         (MEDECIN/ADMIN)
 *   DELETE /api/catalog/medications/{id}         (MEDECIN/ADMIN)
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { Plus, Search, Trash, Pill as PillIcon } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import { useT } from '@/lib/i18n/I18nProvider';
import { CatalogueTabs } from './LabCataloguePage';
import { CatalogImportButton } from './components/CatalogImportButton';
import './catalogue-tabs.css';

interface Medication {
  id: string;
  commercialName: string;
  dci: string;
  form: string;
  dosage: string;
  tags: string | null;
  favorite: boolean;
  active: boolean;
  /** V057 — prix de cession en interne (null = non facturable en interne). */
  internalPrice: number | null;
}

interface Form {
  commercialName: string;
  dci: string;
  form: string;
  dosage: string;
  tags: string;
  favorite: boolean;
  /** V057 — chaîne pour l'input ; '' = pas de prix interne. */
  internalPrice: string;
}

const EMPTY_FORM: Form = {
  commercialName: '',
  dci: '',
  form: 'comprimé',
  dosage: '',
  tags: '',
  favorite: false,
  internalPrice: '',
};

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

export default function CataloguePage() {
  const navigate = useNavigate();
  const { t: tr } = useT();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');

  const [items, setItems] = useState<Medication[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const { settings } = useClinicSettings();
  const pharmacyInternal = settings?.pharmacyInternal ?? false;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Debounced search.
  const [debouncedQ, setDebouncedQ] = useState('');
  // Bumped to force a list reload (e.g. after a successful CSV import).
  const [refreshTick, setRefreshTick] = useState(0);
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
  }, [debouncedQ, tagFilter, refreshTick, tr]);

  const grouped = useMemo(() => {
    const m = new Map<string, Medication[]>();
    for (const it of items) {
      const key = it.dci;
      const list = m.get(key) ?? [];
      list.push(it);
      m.set(key, list);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }
  function openEdit(m: Medication) {
    setEditingId(m.id);
    setForm({
      commercialName: m.commercialName,
      dci: m.dci,
      form: m.form,
      dosage: m.dosage,
      tags: m.tags ?? '',
      favorite: m.favorite,
      internalPrice: m.internalPrice != null ? String(m.internalPrice) : '',
    });
    setDrawerOpen(true);
  }
  async function handleSave() {
    if (!form.commercialName.trim() || !form.dci.trim() || !form.form.trim() || !form.dosage.trim()) {
      toast.error(tr('cat.med.required'));
      return;
    }
    try {
      const body = {
        commercialName: form.commercialName.trim(),
        dci: form.dci.trim(),
        form: form.form.trim(),
        dosage: form.dosage.trim(),
        tags: form.tags.trim() || null,
        favorite: form.favorite,
        active: true,
        // V057 — prix interne : '' → null (non facturable en interne).
        internalPrice: form.internalPrice.trim() ? Number(form.internalPrice) : null,
      };
      if (editingId) {
        await api.put(`/catalog/medications/${editingId}`, body);
        toast.success(tr('cat.med.updated'));
      } else {
        await api.post('/catalog/medications', body);
        toast.success(tr('cat.med.added'));
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      // Force refetch
      setDebouncedQ((v) => v + '');
      const params: Record<string, string> = { limit: '500' };
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      if (tagFilter) params.tag = tagFilter;
      const r = await api.get<Medication[]>('/catalog/medications/browse', { params });
      setItems(r.data);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403
          ? tr('cat.permissionDenied')
          : tr('cat.saveError'),
      );
    }
  }
  async function handleDelete(m: Medication) {
    if (!confirm(tr('cat.med.confirmDeactivate', { name: m.commercialName, dosage: m.dosage }))) return;
    try {
      await api.delete(`/catalog/medications/${m.id}`);
      toast.success(tr('cat.med.deactivated'));
      setItems((xs) => xs.filter((x) => x.id !== m.id));
    } catch {
      toast.error(tr('cat.deleteError'));
    }
  }

  return (
    <Screen
      active="catalogue"
      title={tr('cat.med.title')}
      sub={tr(items.length > 1 ? 'cat.med.sub_plural' : 'cat.med.sub', { n: items.length })}
      topbarRight={
        canEdit ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <CatalogImportButton kind="drug" onImported={() => setRefreshTick((t) => t + 1)} />
            <Button variant="primary" onClick={openCreate}>
              <Plus /> {tr('cat.add')}
            </Button>
          </div>
        ) : undefined
      }
      onNavigate={(navId) => navigate(NAV_MAP[navId])}
    >
      <CatalogueTabs active="medicaments" />
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
              placeholder={tr('cat.med.searchPlaceholder')}
              aria-label={tr('cat.med.searchAria')}
              style={{
                width: '100%', height: 36, padding: '0 12px 0 32px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
            />
          </div>
          <Select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label={tr('cat.med.classAria')}
            style={{
              height: 36, padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
            }}
          >
            <option value="">{tr('cat.med.allClasses')}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </Select>
          {(q || tagFilter) && (
            <button
              type="button"
              onClick={() => { setQ(''); setTagFilter(''); }}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                fontFamily: 'inherit',
              }}
            >
              {tr('cat.reset')}
            </button>
          )}
        </div>

        {/* Tableau */}
        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{tr('common.loading')}</div>
          )}
          {!isLoading && items.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              {tr('cat.med.empty')}
            </div>
          )}
          {!isLoading && items.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th>{tr('cat.med.col.dciName')}</Th>
                  <Th>{tr('cat.med.col.form')}</Th>
                  <Th>{tr('cat.med.col.dosage')}</Th>
                  <Th>{tr('cat.med.col.class')}</Th>
                  {/* V057 — prix interne, colonne visible seulement si la pharmacie interne est activée. */}
                  {pharmacyInternal && (
                    <Th style={{ width: 120, textAlign: 'right' }}>{tr('cat.med.col.internalPrice')}</Th>
                  )}
                  <Th style={{ width: 60, textAlign: 'center' }}>★</Th>
                  {canEdit && <Th style={{ width: 110 }}> </Th>}
                </tr>
              </thead>
              <tbody>
                {grouped.map(([dci, list]) => (
                  list.map((m, idx) => (
                    <tr
                      key={m.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: idx === 0 ? 'var(--bg-alt)' : undefined,
                      }}
                    >
                      <Td>
                        <div style={{ fontWeight: 600 }}>{m.commercialName}</div>
                        {idx === 0 && (
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{dci}</div>
                        )}
                      </Td>
                      <Td>{m.form}</Td>
                      <Td className="tnum">{m.dosage}</Td>
                      <Td>
                        {m.tags && (
                          <span
                            style={{
                              fontSize: 11, padding: '2px 8px',
                              border: '1px solid var(--border)', borderRadius: 12,
                              background: 'var(--surface-2)', color: 'var(--ink-2)',
                            }}
                          >
                            {m.tags}
                          </span>
                        )}
                      </Td>
                      {/* V057 — prix de cession interne (— si non renseigné). */}
                      {pharmacyInternal && (
                        <Td className="tnum" style={{ textAlign: 'right' }}>
                          {m.internalPrice != null ? (
                            <span style={{ fontWeight: 600 }}>
                              {m.internalPrice.toFixed(2)}{' '}
                              <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>MAD</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-3)' }}>—</span>
                          )}
                        </Td>
                      )}
                      <Td style={{ textAlign: 'center' }}>
                        {m.favorite && (
                          <span style={{ color: 'var(--amber)' }} aria-label={tr('cat.favoriteAria')}>★</span>
                        )}
                      </Td>
                      {canEdit && (
                        <Td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => openEdit(m)}
                              style={btnLink}
                            >
                              {tr('common.edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDelete(m); }}
                              aria-label={tr('cat.med.deleteAria', { name: m.commercialName })}
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
                  ))
                ))}
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
              <PillIcon />
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? tr('cat.med.drawer.edit') : tr('cat.med.drawer.new')}
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
              <Field label={tr('cat.med.field.commercialName')} value={form.commercialName} onChange={(v) => setForm({ ...form, commercialName: v })} placeholder={tr('cat.med.field.commercialName.ph')} />
              <Field label={tr('cat.med.field.dci')} value={form.dci} onChange={(v) => setForm({ ...form, dci: v })} placeholder={tr('cat.med.field.dci.ph')} />
              <Field label={tr('cat.med.field.form')} value={form.form} onChange={(v) => setForm({ ...form, form: v })} placeholder={tr('cat.med.field.form.ph')} />
              <Field label={tr('cat.med.field.dosage')} value={form.dosage} onChange={(v) => setForm({ ...form, dosage: v })} placeholder={tr('cat.med.field.dosage.ph')} />
              <Field
                label={tr('cat.med.field.class')}
                value={form.tags}
                onChange={(v) => setForm({ ...form, tags: v })}
                placeholder={tr('cat.med.field.class.ph')}
                hint={tr('cat.med.field.class.hint')}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(e) => setForm({ ...form, favorite: e.target.checked })}
                />
                {tr('cat.med.field.favorite')}
              </label>
              {/* V057 (QA9-6) — prix interne, visible seulement si la pharmacie interne est activée. */}
              {pharmacyInternal && (
                <Field
                  label={tr('cat.med.field.internalPrice')}
                  value={form.internalPrice}
                  onChange={(v) => setForm({ ...form, internalPrice: v.replace(/[^0-9.]/g, '') })}
                  placeholder={tr('cat.med.field.internalPrice.ph')}
                  hint={tr('cat.med.field.internalPrice.hint')}
                />
              )}
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>{tr('common.cancel')}</Button>
              <Button type="button" variant="primary" onClick={() => { void handleSave(); }}>
                {editingId ? tr('cat.med.submit.edit') : tr('cat.med.submit.new')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11.5, padding: '4px 8px', borderRadius: 4,
  color: 'var(--primary)', fontFamily: 'inherit',
};

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
