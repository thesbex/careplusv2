/**
 * Gestion des modèles de consultation SOAP du médecin (monté sur /profil).
 * Chaque modèle = nom + 4 sections (Subjectif / Objectif / Analyse / Plan),
 * réutilisable via le bouton « Modèles » de l'écran consultation.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Plus, Trash } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useSoapTemplates,
  useCreateSoapTemplate,
  useUpdateSoapTemplate,
  useDeleteSoapTemplate,
  type SoapTemplate,
  type SoapTemplateWriteRequest,
} from '../hooks/useSoapTemplates';

interface FormState {
  name: string;
  subjectif: string;
  objectif: string;
  analyse: string;
  plan: string;
}

const EMPTY: FormState = { name: '', subjectif: '', objectif: '', analyse: '', plan: '' };

export function SoapTemplatesTab() {
  const { t: tr } = useT();
  const { templates, isLoading, error } = useSoapTemplates();
  const { create, isPending: creating } = useCreateSoapTemplate();
  const { update, isPending: updating } = useUpdateSoapTemplate();
  const { remove } = useDeleteSoapTemplate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setDrawerOpen(true);
  }
  function openEdit(t: SoapTemplate) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      subjectif: t.subjectif ?? '',
      objectif: t.objectif ?? '',
      analyse: t.analyse ?? '',
      plan: t.plan ?? '',
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(tr('consult.tpl.nameRequired'));
      return;
    }
    const body: SoapTemplateWriteRequest = {
      name: form.name.trim(),
      subjectif: form.subjectif || null,
      objectif: form.objectif || null,
      analyse: form.analyse || null,
      plan: form.plan || null,
    };
    try {
      if (editingId) {
        await update({ id: editingId, body });
        toast.success(tr('consult.tpl.updated'));
      } else {
        await create(body);
        toast.success(tr('consult.tpl.added'));
      }
      setDrawerOpen(false);
      setForm(EMPTY);
      setEditingId(null);
    } catch {
      toast.error(tr('consult.tpl.saveError'));
    }
  }

  async function handleDelete(tpl: SoapTemplate) {
    if (!confirm(tr('consult.tpl.confirmDelete', { name: tpl.name }))) return;
    try {
      await remove(tpl.id);
      toast.success(tr('consult.tpl.deleted'));
    } catch {
      toast.error(tr('consult.tpl.deleteError'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
          {tr('consult.tpl.intro')}
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus /> {tr('consult.tpl.new')}
        </Button>
      </div>

      <Panel style={{ overflow: 'auto', padding: 0 }}>
        {isLoading && <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{tr('common.loading')}</div>}
        {error && <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        {!isLoading && !error && templates.length === 0 && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
            {tr('consult.tpl.empty')}
          </div>
        )}
        {templates.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <Th>{tr('consult.tpl.colName')}</Th>
                <Th style={{ width: 180 }}>{tr('consult.tpl.colUpdated')}</Th>
                <Th style={{ width: 120 }}> </Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td><div style={{ fontWeight: 600 }}>{t.name}</div></Td>
                  <Td style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                    {new Date(t.updatedAt).toLocaleString('fr-MA', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => openEdit(t)} style={btnLink}>{tr('common.edit')}</button>
                      <button type="button" onClick={() => { void handleDelete(t); }}
                        aria-label={tr('consult.tpl.deleteAria', { name: t.name })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, lineHeight: 0 }}>
                        <Trash />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {drawerOpen && (
        <div role="dialog" aria-modal="true" aria-label={editingId ? tr('consult.tpl.editTitle') : tr('consult.tpl.newTitle')}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,0.45)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
          <div style={{ width: 'min(560px, 94vw)', height: '100%', background: 'var(--surface)', boxShadow: '-16px 0 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? tr('consult.tpl.editTitle') : tr('consult.tpl.newTitle')}
              </h2>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label={tr('common.close')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <Labeled label={tr('consult.tpl.nameLabel')}>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={tr('consult.tpl.namePlaceholder')} style={inp} />
              </Labeled>
              <Labeled label={tr('consult.tpl.subjectif')}>
                <textarea value={form.subjectif} onChange={(e) => setForm({ ...form, subjectif: e.target.value })} rows={3} style={ta} />
              </Labeled>
              <Labeled label={tr('consult.tpl.objectif')}>
                <textarea value={form.objectif} onChange={(e) => setForm({ ...form, objectif: e.target.value })} rows={3} style={ta} />
              </Labeled>
              <Labeled label={tr('consult.tpl.analyse')}>
                <textarea value={form.analyse} onChange={(e) => setForm({ ...form, analyse: e.target.value })} rows={3} style={ta} />
              </Labeled>
              <Labeled label={tr('consult.tpl.plan')}>
                <textarea value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} rows={3} style={ta} />
              </Labeled>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>{tr('common.cancel')}</Button>
              <Button type="button" variant="primary" disabled={creating || updating} onClick={() => { void handleSave(); }}>
                {editingId ? tr('common.save') : tr('consult.tpl.addModel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6,
  fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
};
const ta: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
  fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', resize: 'vertical',
};
const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5,
  padding: '4px 8px', borderRadius: 4, color: 'var(--primary)', fontFamily: 'inherit',
};

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '8px 14px', verticalAlign: 'top', ...style }}>{children}</td>;
}
