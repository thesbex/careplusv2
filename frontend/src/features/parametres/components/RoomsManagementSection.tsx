/**
 * Section "Salles de consultation" dans /parametres (V033).
 *
 * Visibilité : toujours rendue. Un cabinet 1 médecin peut avoir 1 salle.
 * Les actions de modification (créer, modifier, désactiver, réactiver) sont
 * réservées aux ADMIN — pour les autres rôles, les boutons sont masqués mais
 * la liste reste visible (pattern cohérent avec SignatureSettingsSection
 * qui, lui, cache totalement la section pour non-ADMIN ; ici on préfère
 * laisser la consultation lecture seule, plus utile au quotidien).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';
import {
  useCreateRoom,
  useDeactivateRoom,
  useRoomsList,
  useUpdateRoom,
  type RoomView,
} from '../hooks/useRoomsAdmin';

interface FormState {
  name: string;
  capabilityTagsRaw: string;
}

const EMPTY_FORM: FormState = { name: '', capabilityTagsRaw: '' };

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export function RoomsManagementSection() {
  const { t } = useT();
  const isAdmin = useAuthStore((s) => s.user?.roles.includes('ADMIN') ?? false);
  const { rooms, isLoading, error } = useRoomsList();
  const { createRoom, isPending: creating } = useCreateRoom();
  const { updateRoom, isPending: updating } = useUpdateRoom();
  const { deactivateRoom, isPending: deactivating } = useDeactivateRoom();

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingActive, setEditingActive] = useState<boolean>(true);

  function resetForm() {
    setDraft(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    setEditingActive(true);
  }

  function openCreate() {
    setDraft(EMPTY_FORM);
    setEditingId(null);
    setEditingActive(true);
    setShowForm(true);
  }

  function openEdit(room: RoomView) {
    setDraft({
      name: room.name,
      capabilityTagsRaw: room.capabilityTags.join(', '),
    });
    setEditingId(room.id);
    setEditingActive(room.active);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      toast.error('Le nom de la salle est requis.');
      return;
    }
    if (draft.name.length > 80) {
      toast.error('Le nom ne peut pas dépasser 80 caractères.');
      return;
    }
    try {
      if (editingId) {
        await updateRoom({
          id: editingId,
          payload: {
            name: draft.name.trim(),
            capabilityTags: parseTags(draft.capabilityTagsRaw),
            active: editingActive,
          },
        });
        toast.success('Salle mise à jour.');
      } else {
        await createRoom({
          name: draft.name.trim(),
          capabilityTags: parseTags(draft.capabilityTagsRaw),
        });
        toast.success('Salle créée.');
      }
      resetForm();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.status === 403) {
        toast.error("Action réservée à l'administrateur.");
      } else {
        toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
      }
    }
  }

  async function handleDeactivate(room: RoomView) {
    if (!confirm(`Désactiver la salle « ${room.name} » ?`)) return;
    try {
      await deactivateRoom(room.id);
      toast.success('Salle désactivée.');
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  }

  async function handleReactivate(room: RoomView) {
    try {
      await updateRoom({
        id: room.id,
        payload: {
          name: room.name,
          capabilityTags: room.capabilityTags,
          active: true,
        },
      });
      toast.success('Salle réactivée.');
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  }

  return (
    <Panel data-testid="rooms-management-section">
      <PanelHeader>
        <span>{t('settings.rooms.title')}</span>
        {isAdmin && (
          <Button
            size="sm"
            variant="primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => (showForm && !editingId ? resetForm() : openCreate())}
          >
            {showForm && !editingId ? t('common.close') : t('settings.rooms.new')}
          </Button>
        )}
      </PanelHeader>
      <div style={{ padding: 16 }}>
        {showForm && (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            style={{
              padding: 14,
              border: '1px solid var(--primary)',
              background: 'var(--primary-soft)',
              borderRadius: 8,
              marginBottom: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <Field>
              <FieldLabel htmlFor="room-name">{t('settings.rooms.name')}</FieldLabel>
              <Input
                id="room-name"
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Salle 1 — Consultation générale"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="room-tags">{t('settings.rooms.equip')}</FieldLabel>
              <Input
                id="room-tags"
                value={draft.capabilityTagsRaw}
                onChange={(e) => setDraft({ ...draft, capabilityTagsRaw: e.target.value })}
                placeholder="échographe, ECG, examen pédiatrique"
              />
            </Field>
            {editingId && (
              <Field style={{ gridColumn: '1 / -1' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editingActive}
                    onChange={(e) => setEditingActive(e.target.checked)}
                  />
                  {t('settings.rooms.active')}
                </label>
              </Field>
            )}
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Button type="button" onClick={resetForm}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={creating || updating}>
                {creating || updating
                  ? t('common.saving')
                  : editingId
                  ? t('common.save')
                  : t('common.create')}
              </Button>
            </div>
          </form>
        )}

        {isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{t('common.loading')}</div>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>
        )}
        {!isLoading && !error && rooms.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            {t('settings.rooms.empty')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rooms.map((room) => (
            <div
              key={room.id}
              data-testid={`room-row-${room.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                opacity: room.active ? 1 : 0.55,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{room.name}</div>
                {room.capabilityTags.length > 0 && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ink-3)',
                      marginTop: 2,
                      display: 'flex',
                      gap: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    {room.capabilityTags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'var(--bg-alt)',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!room.active && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'var(--ink-3)',
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  {t('settings.rooms.inactive')}
                </span>
              )}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(room)}
                    aria-label={`${t('common.edit')} ${room.name}`}
                  >
                    {t('common.edit')}
                  </Button>
                  {room.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deactivating}
                      onClick={() => void handleDeactivate(room)}
                      aria-label={`${t('settings.rooms.deactivate')} ${room.name}`}
                    >
                      {t('settings.rooms.deactivate')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={updating}
                      onClick={() => void handleReactivate(room)}
                      aria-label={`${t('settings.rooms.reactivate')} ${room.name}`}
                    >
                      {t('settings.rooms.reactivate')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
