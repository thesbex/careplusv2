/**
 * Onglet « Courriers confrère » dans Paramétrage (ADMIN).
 *
 * Bibliothèque de modèles de courrier (texte type réutilisable) chargés par le
 * médecin dans la modale « Courrier confrère » pour pré-remplir le corps de la
 * lettre. Miroir de ConsentTemplatesTab, sans la notion de type.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { Plus, Trash } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useLetterTemplates,
  useCreateLetterTemplate,
  useUpdateLetterTemplate,
  useDeleteLetterTemplate,
} from '../hooks/useLetterTemplates';
import { usePractitioners } from '@/features/parametres/hooks/usePractitioners';
import { useAuthStore } from '@/lib/auth/authStore';
import type { LetterTemplateView, LetterTemplateWriteRequest } from '../types';

interface FormState {
  title: string;
  body: string;
  active: boolean;
  /** V065 — "" = modèle partagé cabinet-wide, sinon UUID du médecin. */
  ownerUserId: string;
}

const EMPTY_FORM: FormState = { title: '', body: '', active: true, ownerUserId: '' };

/**
 * mode = 'admin' (Paramètres) : gestion complète, colonne Portée + sélecteur owner.
 * mode = 'own'   (profil médecin) : le médecin gère uniquement SES modèles privés ;
 *   pas de sélecteur de portée (owner forcé sur lui côté backend), modèles cabinet
 *   partagés masqués.
 */
export function LetterTemplatesTab({ mode = 'admin' }: { mode?: 'admin' | 'own' }) {
  const { t } = useT();
  const isOwn = mode === 'own';
  const { templates: allTemplates, isLoading, error } = useLetterTemplates();
  const { create, isPending: creating } = useCreateLetterTemplate();
  const { update, isPending: updating } = useUpdateLetterTemplate();
  const { remove } = useDeleteLetterTemplate();
  const { practitioners } = usePractitioners();
  const practById = new Map(practitioners.map((p) => [p.id, p]));
  const currentUserId = useAuthStore((s) => s.user?.id) ?? '';

  // En mode « own », le médecin ne gère que SES modèles privés (owner = lui) ;
  // les modèles cabinet partagés (owner null) et ceux d'autres médecins sont exclus.
  // (Filtre sur l'id : un utilisateur médecin+admin reçoit toute la liste via l'API.)
  const templates = isOwn
    ? allTemplates.filter((t) => t.ownerUserId === currentUserId)
    : allTemplates;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }
  function openEdit(t: LetterTemplateView) {
    setEditingId(t.id);
    setForm({ title: t.title, body: t.body, active: t.active, ownerUserId: t.ownerUserId ?? '' });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error(t('confrere.tpl.err.titleRequired'));
      return;
    }
    if (!form.body.trim()) {
      toast.error(t('confrere.tpl.err.bodyRequired'));
      return;
    }
    const body: LetterTemplateWriteRequest = {
      title: form.title.trim(),
      body: form.body.trim(),
      active: form.active,
      // mode « own » : modèle privé du médecin connecté (même s'il est aussi admin).
      ownerUserId: isOwn ? currentUserId || null : form.ownerUserId || null,
    };
    try {
      if (editingId) {
        await update({ id: editingId, body });
        toast.success(t('confrere.tpl.toast.updated'));
      } else {
        await create(body);
        toast.success(t('confrere.tpl.toast.added'));
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403
          ? t('confrere.tpl.err.forbidden')
          : t('confrere.tpl.err.saveFailed'),
      );
    }
  }

  async function handleDelete(tpl: LetterTemplateView) {
    if (!confirm(t('confrere.tpl.confirmDelete', { title: tpl.title }))) return;
    try {
      await remove(tpl.id);
      toast.success(t('confrere.tpl.toast.deleted'));
    } catch {
      toast.error(t('confrere.tpl.err.deleteFailed'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
          {isOwn ? t('confrere.tpl.introOwn') : t('confrere.tpl.introAdmin')}
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus /> {t('confrere.tpl.add')}
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
            {t('confrere.tpl.empty')}
          </div>
        )}
        {templates.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <Th>{t('confrere.tpl.col.title')}</Th>
                {!isOwn && <Th style={{ width: 220 }}>{t('confrere.tpl.col.scope')}</Th>}
                <Th style={{ width: 100 }}>{t('confrere.tpl.col.status')}</Th>
                <Th style={{ width: 120 }}> </Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => {
                const ownerPract = tpl.ownerUserId ? practById.get(tpl.ownerUserId) : undefined;
                const scopeLabel = !tpl.ownerUserId
                  ? t('confrere.tpl.scope.shared')
                  : ownerPract
                  ? t('confrere.tpl.scope.doctor', { last: ownerPract.lastName, first: ownerPract.firstName })
                  : t('confrere.tpl.scope.unknown');
                return (
                <tr key={tpl.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td>
                    <div style={{ fontWeight: 600 }}>{tpl.title}</div>
                  </Td>
                  {!isOwn && (
                    <Td>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12,
                        background: tpl.ownerUserId ? 'var(--primary-soft)' : 'var(--surface-2)',
                        color: tpl.ownerUserId ? 'var(--primary)' : 'var(--ink-2)',
                        border: `1px solid ${tpl.ownerUserId ? 'var(--primary)' : 'var(--border)'}`,
                      }}>
                        {scopeLabel}
                      </span>
                    </Td>
                  )}
                  <Td>
                    <span
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12,
                        background: tpl.active ? 'var(--green-soft, #E8F5E9)' : 'var(--surface-2)',
                        color: tpl.active ? '#2E7D32' : 'var(--ink-3)',
                        border: `1px solid ${tpl.active ? '#A5D6A7' : 'var(--border)'}`,
                      }}
                    >
                      {tpl.active ? t('confrere.tpl.active') : t('confrere.tpl.inactive')}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => openEdit(tpl)} style={btnLink}>
                        {t('confrere.tpl.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { void handleDelete(tpl); }}
                        aria-label={t('confrere.tpl.deleteAria', { title: tpl.title })}
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
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? t('confrere.tpl.editAria') : t('confrere.tpl.newAria')}
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
                {editingId ? t('confrere.tpl.editTitle') : t('confrere.tpl.newTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}
                aria-label={t('confrere.tpl.close')}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('confrere.tpl.titleLabel')}</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('confrere.tpl.titlePlaceholder')}
                  style={{
                    height: 34, padding: '0 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('confrere.tpl.bodyLabel')}</span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={12}
                  placeholder={t('confrere.tpl.bodyPlaceholder')}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', resize: 'vertical',
                  }}
                />
              </label>
              {/* V065 — owner picker (ADMIN seulement). Vide = partagé (visible par tous les
                  médecins), un médecin sélectionné = modèle privé visible seulement par lui.
                  En mode « own », la portée est forcée sur le médecin connecté côté backend. */}
              {!isOwn && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('confrere.tpl.scopeLabel')}</span>
                <Select
                  value={form.ownerUserId}
                  onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
                  style={{
                    height: 34, padding: '0 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
                  }}
                >
                  <option value="">{t('confrere.tpl.scopeShared')}</option>
                  {practitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t('confrere.tpl.scopeOption', {
                        last: p.lastName,
                        first: p.firstName,
                        spec: p.specialty ? ` · ${p.specialty}` : '',
                      })}
                    </option>
                  ))}
                </Select>
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                  {t('confrere.tpl.scopeHint')}
                </span>
              </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                  {t('confrere.tpl.activeLabel')}
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
                {editingId ? t('common.save') : t('confrere.tpl.addBtn')}
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
