/**
 * Onglet "Utilisateurs" de /parametres.
 *
 * V032 — étend le formulaire avec :
 *   - champ "Spécialité" visible UNIQUEMENT si rôle = MEDECIN
 *   - section "Médecins gérés" (multi-select practitioners) visible UNIQUEMENT
 *     si rôle ∈ {SECRETAIRE, ASSISTANT} ET >= 2 médecins actifs
 *   - bouton "Modifier" sur chaque ligne (édition existante)
 *
 * Cabinet 1 médecin : la section assignations est cachée — le serveur
 * auto-assigne au médecin unique si on omet le champ.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Trash } from '@/components/icons';
import { api } from '@/lib/api/client';
import { toProblemDetail } from '@/lib/api/problemJson';
import {
  useCreateUser,
  useDeactivateUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
  type AdminUser,
} from '../hooks/useUsers';
import { usePractitioners } from '../hooks/usePractitioners';
import { useClinicSettings } from '../hooks/useSettings';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';

type UserRole =
  | 'SECRETAIRE'
  | 'ASSISTANT'
  | 'MEDECIN'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'LAB'
  | 'RADIO'
  | 'RECEPTIONNISTE';

interface UserDraft {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  specialty: string;
  /** Cochés par défaut côté client à la création (cohérent avec auto-assign serveur). */
  assignedPractitionerIds: string[];
}

function emptyUserDraft(allActiveIds: string[]): UserDraft {
  return {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'SECRETAIRE',
    specialty: '',
    assignedPractitionerIds: allActiveIds,
  };
}

export function UtilisateursTab() {
  const { t } = useT();
  const { users, isLoading, error } = useUsers();
  const { createUser, isPending } = useCreateUser();
  const { updateUser, isPending: isUpdating } = useUpdateUser();
  const { deactivateUser, isPending: isDeactivating } = useDeactivateUser();
  const { resetPassword, isPending: isResetting } = useResetUserPassword();
  const { practitioners } = usePractitioners();
  const { settings } = useClinicSettings();
  // Le rôle RÉCEPTIONNISTE (bureau des admissions) n'a de sens que lorsque
  // l'établissement hospitalise (clinique / hôpital). On ne le propose dans le
  // dropdown que dans ce cas — les utilisateurs existants qui le portent restent
  // affichés (cf. liste plus bas, qui rend les codes tels quels).
  const hospitalizationEnabled =
    settings?.hospitalizationEnabled === true ||
    settings?.establishmentType === 'CLINIQUE' ||
    settings?.establishmentType === 'HOPITAL';
  // Les comptes techniciens internes ne sont proposés que si le service interne
  // correspondant est activé dans Paramètres > Cabinet. On conserve l'option
  // affichée si on édite un utilisateur qui porte déjà ce rôle (capacité
  // désactivée après coup), pour ne pas casser son édition.
  const imagingInternal = settings?.imagingInternal === true;
  const labInternal = settings?.labInternal === true;
  // V069 — seul un super admin peut créer/désigner un autre super admin
  // (un admin normal ne peut pas s'auto-promouvoir aux réglages sensibles).
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));
  const activePractitioners = practitioners.filter((p) => p.active);
  const allActiveIds = activePractitioners.map((p) => p.id);
  const showAssignmentSection = activePractitioners.length >= 2;

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [draft, setDraft] = useState<UserDraft>(() => emptyUserDraft(allActiveIds));

  // V044 — reset-password dialog state.
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  function openReset(user: AdminUser) {
    setResetTarget(user);
    setResetPwd('');
    setResetConfirm('');
  }

  function closeReset() {
    setResetTarget(null);
    setResetPwd('');
    setResetConfirm('');
  }

  async function handleResetSubmit() {
    if (!resetTarget) return;
    if (resetPwd.length < 12) {
      toast.error(t('settings.users.pwdTooShort'));
      return;
    }
    if (resetPwd !== resetConfirm) {
      toast.error(t('settings.users.pwdMismatch'));
      return;
    }
    try {
      await resetPassword({ id: resetTarget.id, password: resetPwd });
      toast.success(t('settings.users.pwdResetOk'), {
        description: t('settings.users.pwdResetDesc'),
      });
      closeReset();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.status === 403) {
        toast.error(t('settings.users.errPerm'));
      } else {
        toast.error(
          problem.title,
          problem.detail ? { description: problem.detail } : undefined,
        );
      }
    }
  }

  function openCreate() {
    setDraft(emptyUserDraft(allActiveIds));
    setEditingUser(null);
    setShowForm(true);
  }

  async function openEdit(user: AdminUser) {
    setEditingUser(user);
    setShowForm(true);
    // GET /admin/users/{id} renvoie email/firstName/lastName/roles/assignedPractitionerIds
    // mais pas specialty/phone. On combine donc avec AdminUser (qui a phone) et
    // /practitioners (qui a specialty pour les MEDECIN).
    const role: UserRole = (user.roles[0] as UserRole) ?? 'SECRETAIRE';
    let assignedIds: string[] = [];
    try {
      const detail = await api
        .get<{ assignedPractitionerIds: string[] }>(`/admin/users/${user.id}`)
        .then((r) => r.data);
      assignedIds = detail.assignedPractitionerIds ?? [];
    } catch {
      assignedIds = role === 'MEDECIN' || role === 'ADMIN' ? [] : allActiveIds;
    }
    const specialtyFromPractitioners =
      role === 'MEDECIN'
        ? practitioners.find((p) => p.id === user.id)?.specialty ?? ''
        : '';
    setDraft({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      role,
      specialty: specialtyFromPractitioners,
      assignedPractitionerIds: assignedIds,
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingUser(null);
    setDraft(emptyUserDraft(allActiveIds));
  }

  function toggleAssignment(id: string) {
    setDraft((prev) => {
      const has = prev.assignedPractitionerIds.includes(id);
      return {
        ...prev,
        assignedPractitionerIds: has
          ? prev.assignedPractitionerIds.filter((x) => x !== id)
          : [...prev.assignedPractitionerIds, id],
      };
    });
  }

  async function handleSubmit() {
    if (!draft.email || !draft.firstName || !draft.lastName) {
      toast.error(t('settings.users.errRequired'));
      return;
    }
    if (!editingUser) {
      if (!draft.password) {
        toast.error(t('settings.users.errPwdRequired'));
        return;
      }
      if (draft.password.length < 12) {
        toast.error(t('settings.users.errPwdLen'));
        return;
      }
    }
    const isAssistantRole = draft.role === 'SECRETAIRE' || draft.role === 'ASSISTANT';
    try {
      if (editingUser) {
        const payload: {
          email: string;
          firstName: string;
          lastName: string;
          phone: string;
          roles: string[];
          specialty?: string | null;
          assignedPractitionerIds?: string[];
        } = {
          email: draft.email,
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          roles: [draft.role],
        };
        if (draft.role === 'MEDECIN') {
          payload.specialty = draft.specialty || null;
        } else {
          payload.specialty = null;
        }
        if (isAssistantRole && showAssignmentSection) {
          payload.assignedPractitionerIds = draft.assignedPractitionerIds;
        } else if (!isAssistantRole) {
          payload.assignedPractitionerIds = [];
        }
        await updateUser({ id: editingUser.id, payload });
        toast.success(t('settings.users.updated'));
      } else {
        const payload: {
          email: string;
          password: string;
          firstName: string;
          lastName: string;
          phone: string;
          roles: string[];
          specialty?: string;
          assignedPractitionerIds?: string[];
        } = {
          email: draft.email,
          password: draft.password,
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          roles: [draft.role],
        };
        if (draft.role === 'MEDECIN' && draft.specialty) {
          payload.specialty = draft.specialty;
        }
        if (isAssistantRole && showAssignmentSection) {
          payload.assignedPractitionerIds = draft.assignedPractitionerIds;
        }
        await createUser(payload);
        toast.success(t('settings.users.created'));
      }
      closeForm();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.status === 403) {
        toast.error(t('settings.users.errPerm'));
      } else if (problem.violations?.length) {
        toast.error(
          problem.violations.map((v) => `${v.field} : ${v.message}`).join(' · '),
        );
      } else {
        toast.error(
          problem.title,
          problem.detail ? { description: problem.detail } : undefined,
        );
      }
    }
  }

  const isAssistantRole = draft.role === 'SECRETAIRE' || draft.role === 'ASSISTANT';
  const isMedecin = draft.role === 'MEDECIN';
  const submitting = editingUser ? isUpdating : isPending;

  return (
    <Panel>
      <PanelHeader>
        <span>{t('settings.users.title')}</span>
        <Button
          size="sm"
          variant="primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => (showForm ? closeForm() : openCreate())}
        >
          {showForm ? t('common.close') : t('common.new')}
        </Button>
      </PanelHeader>
      <div style={{ padding: 16 }}>
        {showForm && (
          <div
            data-testid="user-form-dialog"
            style={{
              padding: 14,
              border: '1px solid var(--primary)',
              background: 'var(--primary-soft)',
              borderRadius: 8,
              marginBottom: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
            }}
          >
            <Field>
              <FieldLabel htmlFor="user-email">{t('settings.users.email')}</FieldLabel>
              <Input
                id="user-email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            {!editingUser && (
              <Field>
                <FieldLabel htmlFor="user-password">{t('settings.users.password')}</FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  {t('settings.users.pwdHint')}
                </div>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="user-role">{t('settings.users.role')}</FieldLabel>
              <Select
                id="user-role"
                aria-label={t('settings.users.role')}
                value={draft.role}
                onChange={(e) =>
                  setDraft({ ...draft, role: e.target.value as UserRole })
                }
                style={{
                  height: 36,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                }}
              >
                <option value="SECRETAIRE">{t('role.SECRETAIRE')}</option>
                <option value="ASSISTANT">{t('role.ASSISTANT')}</option>
                <option value="MEDECIN">{t('role.MEDECIN')}</option>
                <option value="ADMIN">{t('role.ADMIN')}</option>
                {/* V069 — Super administrateur : habilité en plus à l'identité du
                    centre, aux services internes et à l'hospitalisation. Proposé
                    seulement à un super admin (ou si on édite un compte qui l'est déjà). */}
                {(isSuperAdmin || draft.role === 'SUPER_ADMIN') && (
                  <option value="SUPER_ADMIN">{t('role.SUPER_ADMIN')}</option>
                )}
                {/* Techniciens internes — gated sur le service interne correspondant
                    (Paramètres > Cabinet > Services internes). On garde l'option si
                    on édite un utilisateur qui la porte déjà, même service désactivé. */}
                {(labInternal || draft.role === 'LAB') && (
                  <option value="LAB">{t('role.LAB')}</option>
                )}
                {(imagingInternal || draft.role === 'RADIO') && (
                  <option value="RADIO">{t('role.RADIO')}</option>
                )}
                {/* Réceptionniste = bureau des admissions, gated sur la capacité
                    hospitalisation (clinique / hôpital). On garde l'option si on
                    édite un utilisateur qui la porte déjà, même capacité désactivée. */}
                {(hospitalizationEnabled || draft.role === 'RECEPTIONNISTE') && (
                  <option value="RECEPTIONNISTE">{t('role.RECEPTIONNISTE')}</option>
                )}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="user-firstname">{t('settings.users.firstName')}</FieldLabel>
              <Input
                id="user-firstname"
                value={draft.firstName}
                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-lastname">{t('settings.users.lastName')}</FieldLabel>
              <Input
                id="user-lastname"
                value={draft.lastName}
                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-phone">{t('settings.users.phone')}</FieldLabel>
              <Input
                id="user-phone"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            {isMedecin && (
              <Field
                style={{ gridColumn: '1 / -1' }}
                data-testid="user-specialty-field"
              >
                <FieldLabel htmlFor="user-specialty">{t('settings.users.specialty')}</FieldLabel>
                <Input
                  id="user-specialty"
                  maxLength={120}
                  value={draft.specialty}
                  onChange={(e) =>
                    setDraft({ ...draft, specialty: e.target.value })
                  }
                  placeholder={t('settings.users.specialtyPlaceholder')}
                />
              </Field>
            )}
            {isAssistantRole && showAssignmentSection && (
              <div
                style={{ gridColumn: '1 / -1' }}
                data-testid="user-assignment-section"
              >
                <FieldLabel>{t('settings.users.managedDoctors')}</FieldLabel>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-3)',
                    marginBottom: 8,
                  }}
                >
                  {t('settings.users.managedHint')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 10,
                  }}
                >
                  {activePractitioners.map((p) => (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draft.assignedPractitionerIds.includes(p.id)}
                        onChange={() => toggleAssignment(p.id)}
                        aria-label={`${p.firstName} ${p.lastName}`}
                      />
                      <span>
                        {p.firstName} {p.lastName}
                        {p.specialty && (
                          <span
                            style={{
                              fontSize: 11.5,
                              color: 'var(--ink-3)',
                              marginLeft: 6,
                            }}
                          >
                            · {p.specialty}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <Button onClick={closeForm}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting
                  ? editingUser
                    ? t('common.saving')
                    : t('settings.users.creating')
                  : editingUser
                  ? t('common.save')
                  : t('common.create')}
              </Button>
            </div>
          </div>
        )}

        {resetTarget && (
          <div
            data-testid="reset-password-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('settings.users.resetAria', { name: `${resetTarget.firstName} ${resetTarget.lastName}` })}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeReset();
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                width: 'min(420px, calc(100vw - 32px))',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {t('settings.users.resetTitle')}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                {t('settings.users.resetDescPre')}
                <strong>
                  {resetTarget.firstName} {resetTarget.lastName}
                </strong>
                {t('settings.users.resetDescPost')}
              </div>
              <Field>
                <FieldLabel htmlFor="reset-pwd">{t('settings.users.newPwd')}</FieldLabel>
                <Input
                  id="reset-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  {t('settings.users.pwdHint')}
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="reset-pwd-confirm">{t('settings.users.confirm')}</FieldLabel>
                <Input
                  id="reset-pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                />
              </Field>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <Button onClick={closeReset} disabled={isResetting}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  disabled={isResetting}
                  onClick={() => void handleResetSubmit()}
                >
                  {isResetting ? t('settings.users.resetting') : t('settings.users.reset')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{t('common.loading')}</div>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>
        )}
        {users.length === 0 && !isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            {t('settings.users.empty')}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                opacity: u.enabled ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {u.firstName} {u.lastName}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {u.email} {u.phone ? `· ${u.phone}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {u.roles.map((r) => (
                  <span
                    key={r}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    {t(`role.${r}`)}
                  </span>
                ))}
              </div>
              {u.enabled && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${t('common.edit')} ${u.firstName} ${u.lastName}`}
                    onClick={() => void openEdit(u)}
                  >
                    {t('common.edit')}
                  </Button>
                  {u.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('settings.users.resetAria', { name: `${u.firstName} ${u.lastName}` })}
                      onClick={() => openReset(u)}
                    >
                      {t('settings.users.resetPwd')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={t('settings.users.deactivateAria')}
                    disabled={isDeactivating}
                    onClick={() => void deactivateUser(u.id)}
                  >
                    <Trash />
                  </Button>
                </>
              )}
              {!u.enabled && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {t('settings.users.disabled')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
