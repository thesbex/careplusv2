/**
 * Onglet « Notifications » dans Paramétrage (ADMIN).
 *
 * Édition du contenu des messages envoyés au patient (WhatsApp / email) par
 * événement (RDV créé, rappel J-1, ordonnance prête). Placeholders rendus à
 * l'envoi. Miroir de LetterTemplatesTab / ConsentTemplatesTab.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Plus, Trash } from '@/components/icons';
import {
  useNotificationTemplates,
  useCreateNotificationTemplate,
  useUpdateNotificationTemplate,
  useDeleteNotificationTemplate,
} from '../hooks/useNotificationTemplates';
import {
  CHANNEL_LABELS,
  EVENT_LABELS,
  EVENT_ORDER,
  NOTIFICATION_PLACEHOLDERS,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationTemplateView,
  type NotificationTemplateWriteRequest,
} from '../types';

interface FormState {
  eventKey: NotificationEventKey;
  channel: NotificationChannel;
  subject: string;
  body: string;
  whatsappTemplateName: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  eventKey: 'APPOINTMENT_CREATED',
  channel: 'WHATSAPP',
  subject: '',
  body: '',
  whatsappTemplateName: '',
  active: true,
};

export function NotificationTemplatesTab() {
  const { templates, isLoading, error } = useNotificationTemplates();
  const { create, isPending: creating } = useCreateNotificationTemplate();
  const { update, isPending: updating } = useUpdateNotificationTemplate();
  const { remove } = useDeleteNotificationTemplate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }
  function openEdit(t: NotificationTemplateView) {
    setEditingId(t.id);
    setForm({
      eventKey: t.eventKey,
      channel: t.channel,
      subject: t.subject ?? '',
      body: t.body,
      whatsappTemplateName: t.whatsappTemplateName ?? '',
      active: t.active,
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.body.trim()) {
      toast.error('Le corps du message est requis.');
      return;
    }
    const body: NotificationTemplateWriteRequest = {
      eventKey: form.eventKey,
      channel: form.channel,
      body: form.body.trim(),
      active: form.active,
      ...(form.channel === 'EMAIL' && form.subject.trim() ? { subject: form.subject.trim() } : {}),
      ...(form.channel === 'WHATSAPP' && form.whatsappTemplateName.trim()
        ? { whatsappTemplateName: form.whatsappTemplateName.trim() }
        : {}),
    };
    try {
      if (editingId) {
        await update({ id: editingId, body });
        toast.success('Modèle mis à jour.');
      } else {
        await create(body);
        toast.success('Modèle ajouté.');
      }
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403 ? 'Permission refusée (rôle ADMIN requis).' : "Échec de l'enregistrement.",
      );
    }
  }

  async function handleDelete(t: NotificationTemplateView) {
    if (!confirm(`Supprimer le modèle « ${EVENT_LABELS[t.eventKey]} · ${CHANNEL_LABELS[t.channel]} » ?`)) return;
    try {
      await remove(t.id);
      toast.success('Modèle supprimé.');
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
          Contenu des messages envoyés au patient (WhatsApp / email) à la création d'un
          rendez-vous et en rappel la veille. L'envoi réel nécessite la configuration des
          fournisseurs (SMTP, WhatsApp Meta) côté serveur.
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus /> Ajouter un modèle
        </Button>
      </div>

      <Panel style={{ overflow: 'auto', padding: 0 }}>
        {isLoading && <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        {!isLoading && !error && templates.length === 0 && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
            Aucun modèle de notification.
          </div>
        )}
        {templates.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--surface-2)' }}>
              <tr>
                <Th style={{ width: 200 }}>Événement</Th>
                <Th style={{ width: 120 }}>Canal</Th>
                <Th>Aperçu</Th>
                <Th style={{ width: 90 }}>Statut</Th>
                <Th style={{ width: 110 }}> </Th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <Td><span style={{ fontWeight: 600 }}>{EVENT_LABELS[t.eventKey]}</span></Td>
                  <Td>{CHANNEL_LABELS[t.channel]}</Td>
                  <Td>
                    <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                      {t.body.length > 70 ? `${t.body.slice(0, 70)}…` : t.body}
                    </span>
                  </Td>
                  <Td>
                    <span
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 12,
                        background: t.active ? 'var(--green-soft, #E8F5E9)' : 'var(--surface-2)',
                        color: t.active ? '#2E7D32' : 'var(--ink-3)',
                        border: `1px solid ${t.active ? '#A5D6A7' : 'var(--border)'}`,
                      }}
                    >
                      {t.active ? 'Actif' : 'Inactif'}
                    </span>
                  </Td>
                  <Td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" onClick={() => openEdit(t)} style={btnLink}>Modifier</button>
                      <button
                        type="button"
                        onClick={() => { void handleDelete(t); }}
                        aria-label="Supprimer le modèle"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, lineHeight: 0 }}
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
          aria-label={editingId ? 'Modifier le modèle de notification' : 'Nouveau modèle de notification'}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,0.45)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
        >
          <div style={{ width: 'min(520px, 92vw)', height: '100%', background: 'var(--surface)', boxShadow: '-16px 0 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? 'Modifier le modèle' : 'Nouveau modèle de notification'}
              </h2>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }} aria-label="Fermer">×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <label style={fieldLabel}>
                <span style={labelTitle}>Événement *</span>
                <select value={form.eventKey} onChange={(e) => setForm({ ...form, eventKey: e.target.value as NotificationEventKey })} style={inputStyle}>
                  {EVENT_ORDER.map((k) => <option key={k} value={k}>{EVENT_LABELS[k]}</option>)}
                </select>
              </label>
              <label style={fieldLabel}>
                <span style={labelTitle}>Canal *</span>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as NotificationChannel })} style={inputStyle}>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                </select>
              </label>
              {form.channel === 'EMAIL' && (
                <label style={fieldLabel}>
                  <span style={labelTitle}>Sujet (email)</span>
                  <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Confirmation de votre rendez-vous" style={inputStyle} />
                </label>
              )}
              <label style={fieldLabel}>
                <span style={labelTitle}>Corps du message *</span>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} placeholder="Bonjour {{patientPrenom}}, votre RDV du {{date}} à {{heure}} avec {{medecin}} est confirmé." style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical' }} />
              </label>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                Variables :{' '}
                {NOTIFICATION_PLACEHOLDERS.map((p) => (
                  <code key={p} style={{ background: 'var(--surface-2)', borderRadius: 4, padding: '1px 5px', marginRight: 4, fontSize: 11 }}>{p}</code>
                ))}
              </div>
              {form.channel === 'WHATSAPP' && (
                <label style={fieldLabel}>
                  <span style={labelTitle}>Nom du template Meta (WhatsApp)</span>
                  <input type="text" value={form.whatsappTemplateName} onChange={(e) => setForm({ ...form, whatsappTemplateName: e.target.value })} placeholder="appointment_confirmation" style={inputStyle} />
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    Requis pour les messages émis hors fenêtre 24h (template approuvé côté Meta).
                  </span>
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Actif</span>
              </label>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>Annuler</Button>
              <Button type="button" variant="primary" disabled={creating || updating} onClick={() => { void handleSave(); }}>
                {editingId ? 'Enregistrer' : 'Ajouter le modèle'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 6,
  fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
};
const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 };
const labelTitle: React.CSSProperties = { color: 'var(--ink-3)', fontWeight: 600 };
const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5,
  padding: '4px 8px', borderRadius: 4, color: 'var(--primary)', fontFamily: 'inherit',
};

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em', ...style }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '8px 14px', verticalAlign: 'top', ...style }}>{children}</td>;
}
