/**
 * Catalogue radio / imagerie — desktop.
 *
 * Endpoints :
 *   GET    /api/catalog/imaging-exams?q=
 *   POST   /api/catalog/imaging-exams              (MEDECIN/ADMIN)
 *   PUT    /api/catalog/imaging-exams/{id}         (MEDECIN/ADMIN)
 *   DELETE /api/catalog/imaging-exams/{id}         (MEDECIN/ADMIN)
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
import { CatalogueTabs } from './LabCataloguePage';
import { CatalogImportButton } from './components/CatalogImportButton';
import './catalogue-tabs.css';

interface ImagingExam {
  id: string;
  code: string;
  name: string;
  modality: string | null;
}

interface Form {
  code: string;
  name: string;
  modality: string;
}

const EMPTY_FORM: Form = { code: '', name: '', modality: 'RADIO' };

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
  const userRoles = useAuthStore((s) => s.user?.roles ?? []);
  const canEdit = userRoles.includes('MEDECIN') || userRoles.includes('ADMIN');
  const [items, setItems] = useState<ImagingExam[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modalityFilter, setModalityFilter] = useState<string>('');
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
      .get<ImagingExam[]>('/catalog/imaging-exams', {
        params: debouncedQ.trim() ? { q: debouncedQ.trim() } : {},
      })
      .then((r) => setItems(r.data))
      .catch(() => toast.error('Impossible de charger les examens d’imagerie.'))
      .finally(() => setIsLoading(false));
  }, [debouncedQ, refreshTick]);

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

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(e: ImagingExam) {
    setEditingId(e.id);
    setForm({ code: e.code, name: e.name, modality: e.modality ?? '' });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Champs requis : Code, Nom.');
      return;
    }
    try {
      const body = {
        code: form.code.trim(),
        name: form.name.trim(),
        modality: form.modality.trim() || null,
      };
      if (editingId) {
        await api.put(`/catalog/imaging-exams/${editingId}`, body);
        toast.success('Examen mis à jour.');
      } else {
        await api.post('/catalog/imaging-exams', body);
        toast.success('Examen ajouté au catalogue.');
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      if (e.response?.status === 409) {
        toast.error('Ce code est déjà utilisé.');
      } else if (e.response?.status === 403) {
        toast.error('Permission refusée (rôle MEDECIN ou ADMIN requis).');
      } else {
        toast.error("Échec de l'enregistrement.");
      }
    }
  }

  async function handleDelete(e: ImagingExam) {
    if (!confirm(`Désactiver l'examen « ${e.name} » du catalogue ?`)) return;
    try {
      await api.delete(`/catalog/imaging-exams/${e.id}`);
      toast.success('Examen désactivé.');
      setItems((xs) => xs.filter((x) => x.id !== e.id));
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  return (
    <Screen
      active="catalogue"
      title="Catalogue radio / imagerie"
      sub={`${filtered.length} examen${filtered.length > 1 ? 's' : ''}`}
      topbarRight={
        canEdit ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <CatalogImportButton kind="imaging" onImported={() => setRefreshTick((t) => t + 1)} />
            <Button variant="primary" onClick={openCreate}>
              <Plus /> Ajouter
            </Button>
          </div>
        ) : undefined
      }
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
                  {canEdit && <Th style={{ width: 110 }}> </Th>}
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
                      {canEdit && (
                        <Td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => openEdit(e)}
                              style={btnLink}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDelete(e); }}
                              aria-label={`Supprimer ${e.name}`}
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
                {editingId ? "Modifier l'examen" : 'Nouvel examen'}
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
              <Field label="Code *" value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder="ex. RX-THX, ECHO-ABD…" hint="Identifiant unique servant aux prescriptions." />
              <Field label="Nom *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="ex. Radio thorax face" />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Modalité</span>
                <select
                  value={form.modality}
                  onChange={(e) => setForm({ ...form, modality: e.target.value })}
                  style={{
                    height: 34, padding: '0 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
                  }}
                >
                  <option value="RADIO">RADIO</option>
                  <option value="ECHO">ECHO</option>
                  <option value="SCANNER">SCANNER</option>
                  <option value="IRM">IRM</option>
                  <option value="">— Autre —</option>
                </select>
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
