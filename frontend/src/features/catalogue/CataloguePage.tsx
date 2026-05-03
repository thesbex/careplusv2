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
import { Plus, Search, Trash, Pill as PillIcon } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
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
}

interface Form {
  commercialName: string;
  dci: string;
  form: string;
  dosage: string;
  tags: string;
  favorite: boolean;
}

const EMPTY_FORM: Form = {
  commercialName: '',
  dci: '',
  form: 'comprimé',
  dosage: '',
  tags: '',
  favorite: false,
};

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  vaccinations: '/vaccinations',
  stock: '/stock',
  catalogue: '/catalogue',
  params: '/parametres',
} as const;

export default function CataloguePage() {
  const navigate = useNavigate();
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');

  const [items, setItems] = useState<Medication[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
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
      .catch(() => toast.error('Impossible de charger le catalogue.'))
      .finally(() => setIsLoading(false));
  }, [debouncedQ, tagFilter, refreshTick]);

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
    });
    setDrawerOpen(true);
  }
  async function handleSave() {
    if (!form.commercialName.trim() || !form.dci.trim() || !form.form.trim() || !form.dosage.trim()) {
      toast.error('Champs requis : Nom commercial, DCI, Forme, Dosage.');
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
      };
      if (editingId) {
        await api.put(`/catalog/medications/${editingId}`, body);
        toast.success('Médicament mis à jour.');
      } else {
        await api.post('/catalog/medications', body);
        toast.success('Médicament ajouté au catalogue.');
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
          ? 'Permission refusée (rôle MEDECIN ou ADMIN requis).'
          : 'Échec de l\'enregistrement.',
      );
    }
  }
  async function handleDelete(m: Medication) {
    if (!confirm(`Désactiver « ${m.commercialName} ${m.dosage} » du catalogue ?`)) return;
    try {
      await api.delete(`/catalog/medications/${m.id}`);
      toast.success('Médicament désactivé.');
      setItems((xs) => xs.filter((x) => x.id !== m.id));
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  return (
    <Screen
      active="catalogue"
      title="Catalogue médicaments"
      sub={`${items.length} entrée${items.length > 1 ? 's' : ''} commercialisée${items.length > 1 ? 's' : ''} au Maroc`}
      topbarRight={
        canEdit ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <CatalogImportButton kind="drug" onImported={() => setRefreshTick((t) => t + 1)} />
            <Button variant="primary" onClick={openCreate}>
              <Plus /> Ajouter
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
              placeholder="Rechercher par nom commercial ou DCI…"
              style={{
                width: '100%', height: 36, padding: '0 12px 0 32px',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
              }}
            />
          </div>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            style={{
              height: 36, padding: '0 10px',
              border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
            }}
          >
            <option value="">Toutes les classes</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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
              Réinitialiser
            </button>
          )}
        </div>

        {/* Tableau */}
        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          )}
          {!isLoading && items.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun médicament ne correspond à la recherche.
            </div>
          )}
          {!isLoading && items.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th>DCI / Nom commercial</Th>
                  <Th>Forme</Th>
                  <Th>Dosage</Th>
                  <Th>Classe</Th>
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
                      <Td style={{ textAlign: 'center' }}>
                        {m.favorite && (
                          <span style={{ color: 'var(--amber)' }} aria-label="Favori">★</span>
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
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDelete(m); }}
                              aria-label={`Supprimer ${m.commercialName}`}
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
                {editingId ? 'Modifier le médicament' : 'Nouveau médicament'}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <Field label="Nom commercial *" value={form.commercialName} onChange={(v) => setForm({ ...form, commercialName: v })} placeholder="ex. Doliprane" />
              <Field label="DCI (molécule) *" value={form.dci} onChange={(v) => setForm({ ...form, dci: v })} placeholder="ex. Paracétamol" />
              <Field label="Forme *" value={form.form} onChange={(v) => setForm({ ...form, form: v })} placeholder="comprimé, sirop, gélule…" />
              <Field label="Dosage *" value={form.dosage} onChange={(v) => setForm({ ...form, dosage: v })} placeholder="500mg, 10mg/ml…" />
              <Field
                label="Classe pharmacologique"
                value={form.tags}
                onChange={(v) => setForm({ ...form, tags: v })}
                placeholder="ex. ains, ipp, antalgique, penicillines…"
                hint="Sert au contrôle des allergies (les substances déclarées chez le patient sont matchées sur ce tag)."
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(e) => setForm({ ...form, favorite: e.target.checked })}
                />
                Marquer comme favori (apparaît en haut des suggestions)
              </label>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>Annuler</Button>
              <Button type="button" variant="primary" onClick={() => { void handleSave(); }}>
                {editingId ? 'Enregistrer' : 'Ajouter au catalogue'}
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
