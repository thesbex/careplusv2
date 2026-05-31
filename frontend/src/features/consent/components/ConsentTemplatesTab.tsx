/**
 * QA9-13 — Onglet "Consentements" dans Paramétrage (ADMIN).
 *
 * Liste des modèles de consentement (type FR, titre, actif), bouton
 * "Ajouter un modèle" → tiroir (type, titre, corps + aide placeholders,
 * actif). Édition par ligne, suppression avec confirmation (soft-delete).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { Plus, Trash } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useConsentTemplates,
  useCreateConsentTemplate,
  useUpdateConsentTemplate,
  useDeleteConsentTemplate,
} from '../hooks/useConsentTemplates';
import {
  CONSENT_TYPE_ORDER,
  CONSENT_PLACEHOLDERS,
  type ConsentTemplateView,
  type ConsentType,
  type ConsentTemplateWriteRequest,
} from '../types';

interface FormState {
  type: ConsentType;
  title: string;
  body: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  type: 'PARTAGE_DOSSIER',
  title: '',
  body: '',
  active: true,
};

export function ConsentTemplatesTab() {
  const { t } = useT();
  const { templates, isLoading, error } = useConsentTemplates();
  const { create, isPending: creating } = useCreateConsentTemplate();
  const { update, isPending: updating } = useUpdateConsentTemplate();
  const { remove } = useDeleteConsentTemplate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }
  function openEdit(t: ConsentTemplateView) {
    setEditingId(t.id);
    setForm({ type: t.type, title: t.title, body: t.body, active: t.active });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error(t('consent.tpl.err.titleRequired'));
      return;
    }
    if (!form.body.trim()) {
      toast.error(t('consent.tpl.err.bodyRequired'));
      return;
    }
    const body: ConsentTemplateWriteRequest = {
      type: form.type,
      title: form.title.trim(),
      body: form.body.trim(),
      active: form.active,
    };
    try {
      if (editingId) {
        await update({ id: editingId, body });
        toast.success(t('consent.tpl.toast.updated'));
      } else {
        await create(body);
        toast.success(t('consent.tpl.toast.added'));
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403
          ? t('consent.tpl.err.forbidden')
          : t('consent.tpl.err.saveFailed'),
      );
    }
  }

  async function handleDelete(tpl: ConsentTemplateView) {
    if (!confirm(t('consent.tpl.confirmDelete', { title: tpl.title }))) return;
    try {
      await remove(tpl.id);
      toast.success(t('consent.tpl.toast.deleted'));
    } catch {
      toast.error(t('consent.tpl.err.deleteFailed'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
          {t('consent.tpl.intro')}
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus /> {t('consent.tpl.add')}
        </Button>
      </div>

      <Panel style={{ overflow: 'auto', padding: 0 }}>
        {isLoading && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{t('common.loading')}</div>
        )}
        {error && (
          <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{t(error)}</div>
        )}
        {!isLoading && !error && templates.length === 0 && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
            {t('consent.tpl.empty')}
          </div>
        )}
        {templates.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <Th style={{ width: 180 }}>{t('consent.tpl.col.type')}</Th>
                <Th>{t('consent.tpl.col.title')}</Th>
                <Th style={{ width: 100 }}>{t('consent.tpl.col.status')}</Th>
                <Th style={{ width: 120 }}> </Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>
                    <span
                      style={{
                        fontSize: 11, padding: '2px 8px',
                        border: '1px solid var(--border)', borderRadius: 12,
                        background: 'var(--surface-2)', color: 'var(--ink-2)',
                      }}
                    >
                      {t(`consent.type.${tpl.type}`)}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ fontWeight: 600 }}>{tpl.title}</div>
                  </Td>
                  <Td>
                    <span
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12,
                        background: tpl.active ? 'var(--green-soft, #E8F5E9)' : 'var(--surface-2)',
                        color: tpl.active ? '#2E7D32' : 'var(--ink-3)',
                        border: `1px solid ${tpl.active ? '#A5D6A7' : 'var(--border)'}`,
                      }}
                    >
                      {tpl.active ? t('consent.tpl.active') : t('consent.tpl.inactive')}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => openEdit(tpl)} style={btnLink}>
                        {t('consent.tpl.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleDelete(tpl); }}
                        aria-label={t('consent.tpl.deleteAria', { title: tpl.title })}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--danger)', padding: 4, lineHeight: 0,
                        }}
                      >
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? t('consent.tpl.editAria') : t('consent.tpl.newAria')}
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
              width: 'min(520px, 92vw)', height: '100%',
              background: 'var(--surface)', boxShadow: '-16px 0 40px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? t('consent.tpl.editTitle') : t('consent.tpl.newTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}
                aria-label={t('consent.tpl.close')}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('consent.tpl.typeLabel')}</span>
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ConsentType })}
                  style={{
                    height: 34, padding: '0 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
                  }}
                >
                  {CONSENT_TYPE_ORDER.map((c) => (
                    <option key={c} value={c}>{t(`consent.type.${c}`)}</option>
                  ))}
                </Select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('consent.tpl.titleLabel')}</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('consent.tpl.titlePlaceholder')}
                  style={{
                    height: 34, padding: '0 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('consent.tpl.bodyLabel')}</span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={10}
                  placeholder={t('consent.tpl.bodyPlaceholder')}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', resize: 'vertical',
                  }}
                />
              </label>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                {t('consent.tpl.placeholdersHint')}{' '}
                {CONSENT_PLACEHOLDERS.map((p) => (
                  <code
                    key={p}
                    style={{
                      background: 'var(--surface-2)', borderRadius: 4,
                      padding: '1px 5px', marginRight: 4, fontSize: 11,
                    }}
                  >
                    {p}
                  </code>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                  {t('consent.tpl.activeLabel')}
                </span>
              </label>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>{t('common.cancel')}</Button>
              <Button
                type="button"
                variant="primary"
                disabled={creating || updating}
                onClick={() => { void handleSave(); }}
              >
                {editingId ? t('common.save') : t('consent.tpl.addBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
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
