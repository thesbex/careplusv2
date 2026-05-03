/**
 * Onglet "Vaccinations" dans ParametragePage.
 * Section 1 — Vaccins (référentiel catalog)
 * Section 2 — Calendrier (schedule doses)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Edit, Trash } from '@/components/icons';
import { useVaccinationCatalog } from '../hooks/useVaccinationCatalog';
import { useVaccinationSchedule } from '../hooks/useVaccinationSchedule';
import { useUpsertVaccine, type UpsertVaccineBody } from '../hooks/useUpsertVaccine';
import { useDeactivateVaccine } from '../hooks/useDeactivateVaccine';
import { useUpsertScheduleDose, type UpsertScheduleDoseBody } from '../hooks/useUpsertScheduleDose';
import { useDeleteScheduleDose } from '../hooks/useDeleteScheduleDose';
import { UpsertVaccineSchema, UpsertScheduleDoseSchema } from '../schemas';
import type { UpsertVaccineValues, UpsertScheduleDoseValues } from '../schemas';
import { toProblemDetail } from '@/lib/api/problemJson';
import type { VaccineCatalogEntry } from '../types';
import type { VaccineScheduleDose } from '../hooks/useVaccinationSchedule';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROUTE_LABELS: Record<string, string> = {
  IM: 'IM — Intramusculaire',
  SC: 'SC — Sous-cutané',
  PO: 'PO — Per os (oral)',
  ID: 'ID — Intradermique',
};

function formatTargetAge(days: number): string {
  if (days === 0) return 'Naissance';
  if (days < 30) return `${days} j`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} ans`;
  return `${years} ans ${rem} mois`;
}

// ── Vaccine form drawer ──────────────────────────────────────────────────────

interface VaccineFormDrawerProps {
  mode: 'create' | 'edit';
  initial?: VaccineCatalogEntry;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_VACCINE: UpsertVaccineValues = {
  code: '',
  nameFr: '',
  manufacturerDefault: undefined,
  routeDefault: undefined,
  active: true,
  isPni: false,
};

function VaccineFormDrawer({ mode, initial, onClose, onSaved }: VaccineFormDrawerProps) {
  const mutation = useUpsertVaccine(mode);

  const defaultValues: UpsertVaccineValues =
    mode === 'edit' && initial
      ? {
          code: initial.code,
          nameFr: initial.nameFr,
          manufacturerDefault: initial.manufacturerDefault ?? undefined,
          routeDefault: initial.routeDefault ?? undefined,
          active: initial.active,
          isPni: initial.isPni,
        }
      : EMPTY_VACCINE;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpsertVaccineValues>({
    resolver: zodResolver(UpsertVaccineSchema),
    defaultValues,
  });

  async function onSubmit(values: UpsertVaccineValues) {
    const body: UpsertVaccineBody = {
      code: values.code,
      nameFr: values.nameFr,
      manufacturerDefault: values.manufacturerDefault ?? null,
      routeDefault: values.routeDefault ?? null,
      active: values.active,
      isPni: false, // UI never allows creating PNI vaccines
    };
    try {
      await mutation.mutateAsync(initial?.id ? { id: initial.id, body } : { body });
      toast.success(mode === 'create' ? 'Vaccin ajouté.' : 'Vaccin modifié.');
      onSaved();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.violations?.length) {
        toast.error(problem.violations.map((v) => `${v.field} : ${v.message}`).join(' · '));
      } else {
        toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'relative',
          width: 400,
          height: '100%',
          background: 'var(--surface)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {mode === 'create' ? 'Ajouter un vaccin' : 'Modifier le vaccin'}
        </div>

        <form
          id="vaccine-form"
          onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field>
            <FieldLabel htmlFor="vac-code">Code *</FieldLabel>
            <Input
              id="vac-code"
              placeholder="BCG"
              {...register('code', {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  e.target.value = e.target.value.toUpperCase();
                },
              })}
              disabled={mode === 'edit'}
              style={{ textTransform: 'uppercase' }}
            />
            {errors.code && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.code.message}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="vac-name">Nom *</FieldLabel>
            <Input id="vac-name" placeholder="BCG — vaccin antituberculeux" {...register('nameFr')} />
            {errors.nameFr && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.nameFr.message}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="vac-mfr">Fabricant par défaut</FieldLabel>
            <Input id="vac-mfr" placeholder="Sanofi, MSD, GSK…" {...register('manufacturerDefault')} />
          </Field>

          <Field>
            <FieldLabel htmlFor="vac-route">Voie par défaut</FieldLabel>
            <select
              id="vac-route"
              {...register('routeDefault')}
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
              <option value="">—</option>
              {Object.entries(ROUTE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="vac-active" {...register('active')} style={{ width: 16, height: 16 }} />
            <label htmlFor="vac-active" style={{ fontSize: 13, cursor: 'pointer' }}>Actif</label>
          </div>

          {mode === 'edit' && initial?.isPni && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--primary-soft)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--primary)',
              }}
            >
              Vaccin PNI — le flag PNI est géré uniquement via le seed base de données.
            </div>
          )}
        </form>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
          }}
        >
          <Button
            type="submit"
            form="vaccine-form"
            variant="primary"
            disabled={mutation.isPending}
            style={{ flex: 1 }}
          >
            {mutation.isPending ? 'Enregistrement…' : mode === 'create' ? 'Ajouter' : 'Enregistrer'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule dose form drawer ─────────────────────────────────────────────────

interface ScheduleDoseFormDrawerProps {
  mode: 'create' | 'edit';
  initial?: VaccineScheduleDose;
  vaccines: VaccineCatalogEntry[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_DOSE: UpsertScheduleDoseValues = {
  vaccineId: '',
  doseNumber: 1,
  targetAgeDays: 0,
  toleranceDays: 30,
  labelFr: '',
};

const TARGET_AGE_HELPERS = [
  { label: 'Naissance', value: 0 },
  { label: '2 mois', value: 60 },
  { label: '4 mois', value: 120 },
  { label: '12 mois', value: 365 },
  { label: '18 mois', value: 548 },
  { label: '5 ans', value: 1825 },
];

function ScheduleDoseFormDrawer({
  mode,
  initial,
  vaccines,
  onClose,
  onSaved,
}: ScheduleDoseFormDrawerProps) {
  const mutation = useUpsertScheduleDose(mode);

  const defaultValues: UpsertScheduleDoseValues =
    mode === 'edit' && initial
      ? {
          vaccineId: initial.vaccineId,
          doseNumber: initial.doseNumber,
          targetAgeDays: initial.targetAgeDays,
          toleranceDays: initial.toleranceDays,
          labelFr: initial.labelFr,
        }
      : EMPTY_DOSE;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UpsertScheduleDoseValues>({
    resolver: zodResolver(UpsertScheduleDoseSchema),
    defaultValues,
  });

  async function onSubmit(values: UpsertScheduleDoseValues) {
    const body: UpsertScheduleDoseBody = {
      vaccineId: values.vaccineId,
      doseNumber: values.doseNumber,
      targetAgeDays: values.targetAgeDays,
      toleranceDays: values.toleranceDays,
      labelFr: values.labelFr,
    };
    try {
      await mutation.mutateAsync(initial?.id ? { id: initial.id, body } : { body });
      toast.success(mode === 'create' ? 'Dose ajoutée au calendrier.' : 'Dose modifiée.');
      onSaved();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.status === 409) {
        toast.error('Cette dose existe déjà pour ce vaccin');
      } else if (problem.violations?.length) {
        toast.error(problem.violations.map((v) => `${v.field} : ${v.message}`).join(' · '));
      } else {
        toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
      }
    }
  }

  const activeVaccines = vaccines.filter((v) => v.active);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'relative',
          width: 440,
          height: '100%',
          background: 'var(--surface)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {mode === 'create' ? 'Ajouter une dose au calendrier' : 'Modifier la dose'}
        </div>

        <form
          id="schedule-dose-form"
          onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field>
            <FieldLabel htmlFor="sd-vaccine">Vaccin *</FieldLabel>
            <select
              id="sd-vaccine"
              {...register('vaccineId')}
              style={{
                height: 36,
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            >
              <option value="">Sélectionner un vaccin…</option>
              {activeVaccines.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nameFr} ({v.code})
                </option>
              ))}
            </select>
            {errors.vaccineId && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.vaccineId.message}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="sd-dose-number">Numéro de dose *</FieldLabel>
            <Input
              id="sd-dose-number"
              type="number"
              min={1}
              {...register('doseNumber', { valueAsNumber: true })}
            />
            {errors.doseNumber && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.doseNumber.message}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="sd-target-age">Âge cible (jours) *</FieldLabel>
            <Input
              id="sd-target-age"
              type="number"
              min={0}
              {...register('targetAgeDays', { valueAsNumber: true })}
            />
            {errors.targetAgeDays && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.targetAgeDays.message}
              </div>
            )}
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TARGET_AGE_HELPERS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => setValue('targetAgeDays', h.value)}
                  style={{
                    padding: '2px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    background: 'var(--surface-2)',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  {h.label}={h.value}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
              Naissance=0, 2 mois=60, 12 mois=365, 5 ans=1825
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="sd-tolerance">Tolérance (jours) *</FieldLabel>
            <Input
              id="sd-tolerance"
              type="number"
              min={0}
              {...register('toleranceDays', { valueAsNumber: true })}
            />
            {errors.toleranceDays && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.toleranceDays.message}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="sd-label">Libellé *</FieldLabel>
            <Input id="sd-label" placeholder="Ex. BCG Naissance D1" {...register('labelFr')} />
            {errors.labelFr && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {errors.labelFr.message}
              </div>
            )}
          </Field>
        </form>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
          }}
        >
          <Button
            type="submit"
            form="schedule-dose-form"
            variant="primary"
            disabled={mutation.isPending}
            style={{ flex: 1 }}
          >
            {mutation.isPending ? 'Enregistrement…' : mode === 'create' ? 'Ajouter' : 'Enregistrer'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteScheduleDoseDialog({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-md)',
          padding: '24px',
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
          Supprimer cette ligne du calendrier ?
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>
          Les doses déjà saisies sur les patients ne seront pas affectées.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={onConfirm}
            style={{ background: 'var(--danger)', border: 'none' }}
          >
            {isPending ? 'Suppression…' : 'Supprimer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Section 1 — Catalog ───────────────────────────────────────────────────────

function VaccineCatalogSection() {
  const { catalog, isLoading, error } = useVaccinationCatalog();
  const { deactivate, isPending: isDeactivating } = useDeactivateVaccine();
  const [showDrawer, setShowDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<VaccineCatalogEntry | undefined>(undefined);

  function openCreate() {
    setEditTarget(undefined);
    setShowDrawer(true);
  }

  function openEdit(v: VaccineCatalogEntry) {
    setEditTarget(v);
    setShowDrawer(true);
  }

  function closeDrawer() {
    setShowDrawer(false);
    setEditTarget(undefined);
  }

  async function handleDeactivate(vaccine: VaccineCatalogEntry) {
    if (vaccine.isPni) {
      toast.error('Vaccin PNI : désactivation interdite');
      return;
    }
    await deactivate(vaccine.id).catch(() => null);
  }

  return (
    <>
      <Panel>
        <PanelHeader>
          <div>
            <div style={{ fontWeight: 600 }}>Vaccins</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 400, marginTop: 2 }}>
              Catalogue PNI Maroc + vaccins ajoutés par le cabinet
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            style={{ marginLeft: 'auto' }}
            onClick={openCreate}
          >
            Ajouter un vaccin
          </Button>
        </PanelHeader>
        <div style={{ overflowX: 'auto' }}>
          {isLoading && (
            <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>
          )}
          {error && (
            <div style={{ padding: 16, color: 'var(--danger)', fontSize: 12 }}>{error}</div>
          )}
          {!isLoading && !error && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Code', 'Nom', 'Fabricant', 'Voie', 'PNI', 'Actif', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--ink-3)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catalog.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px 12px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
                      Aucun vaccin dans le catalogue.
                    </td>
                  </tr>
                )}
                {catalog.map((v) => (
                  <tr
                    key={v.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: v.active ? 1 : 0.55,
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'var(--font-mono, monospace)' }}>
                      {v.code}
                    </td>
                    <td style={{ padding: '8px 12px' }}>{v.nameFr}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-3)' }}>
                      {v.manufacturerDefault ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {v.routeDefault ? (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: 'var(--primary-soft)',
                            color: 'var(--primary)',
                            fontWeight: 600,
                          }}
                        >
                          {v.routeDefault}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-3)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {v.isPni && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 7px',
                            borderRadius: 999,
                            background: 'var(--status-arrived-soft, #f0fdf4)',
                            color: 'var(--status-arrived, #16a34a)',
                            fontWeight: 600,
                          }}
                        >
                          PNI
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={v.active}
                        readOnly
                        aria-label={`${v.nameFr} actif`}
                        style={{ width: 16, height: 16, cursor: 'default' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          aria-label={`Modifier ${v.nameFr}`}
                          onClick={() => openEdit(v)}
                        >
                          <Edit />
                        </Button>
                        {!v.isPni && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            aria-label={`Désactiver ${v.nameFr}`}
                            disabled={isDeactivating}
                            onClick={() => void handleDeactivate(v)}
                          >
                            <Trash />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      {showDrawer && (
        <VaccineFormDrawer
          mode={editTarget ? 'edit' : 'create'}
          {...(editTarget ? { initial: editTarget } : {})}
          onClose={closeDrawer}
          onSaved={closeDrawer}
        />
      )}
    </>
  );
}

// ── Section 2 — Schedule ──────────────────────────────────────────────────────

function VaccineScheduleSection() {
  const { schedule, isLoading, error } = useVaccinationSchedule();
  const { catalog } = useVaccinationCatalog();
  const { deleteDose, isPending: isDeleting, deletingId } = useDeleteScheduleDose();

  const [showDoseDrawer, setShowDoseDrawer] = useState(false);
  const [editDoseTarget, setEditDoseTarget] = useState<VaccineScheduleDose | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<VaccineScheduleDose | null>(null);

  function openCreateDose() {
    setEditDoseTarget(undefined);
    setShowDoseDrawer(true);
  }

  function openEditDose(d: VaccineScheduleDose) {
    setEditDoseTarget(d);
    setShowDoseDrawer(true);
  }

  function closeDoseDrawer() {
    setShowDoseDrawer(false);
    setEditDoseTarget(undefined);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteDose(deleteTarget.id).catch(() => null);
    setDeleteTarget(null);
  }

  return (
    <>
      <Panel>
        <PanelHeader>
          <div>
            <div style={{ fontWeight: 600 }}>Calendrier vaccinal</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 400, marginTop: 2 }}>
              Doses planifiées par âge — éditable selon les recommandations PNI
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            style={{ marginLeft: 'auto' }}
            onClick={openCreateDose}
          >
            Ajouter une dose
          </Button>
        </PanelHeader>
        <div style={{ overflowX: 'auto' }}>
          {isLoading && (
            <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>
          )}
          {error && (
            <div style={{ padding: 16, color: 'var(--danger)', fontSize: 12 }}>{error}</div>
          )}
          {!isLoading && !error && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Vaccin', 'N° dose', 'Âge cible', 'Tolérance', 'Libellé', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--ink-3)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 12px', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
                      Aucune dose dans le calendrier.
                    </td>
                  </tr>
                )}
                {schedule.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 550 }}>
                      {d.vaccineNameFr}
                      <span
                        style={{
                          marginLeft: 4,
                          fontSize: 11,
                          color: 'var(--ink-3)',
                          fontWeight: 400,
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        ({d.vaccineCode})
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-2)' }}>{d.doseNumber}</td>
                    <td style={{ padding: '8px 12px' }}>{formatTargetAge(d.targetAgeDays)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-2)' }}>
                      ± {d.toleranceDays} j
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-2)' }}>{d.labelFr}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          aria-label={`Modifier ${d.labelFr}`}
                          onClick={() => openEditDose(d)}
                        >
                          <Edit />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          aria-label={`Supprimer ${d.labelFr}`}
                          disabled={isDeleting && deletingId === d.id}
                          onClick={() => setDeleteTarget(d)}
                        >
                          <Trash />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      {showDoseDrawer && (
        <ScheduleDoseFormDrawer
          mode={editDoseTarget ? 'edit' : 'create'}
          {...(editDoseTarget ? { initial: editDoseTarget } : {})}
          vaccines={catalog}
          onClose={closeDoseDrawer}
          onSaved={closeDoseDrawer}
        />
      )}

      {deleteTarget && (
        <DeleteScheduleDoseDialog
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
          isPending={isDeleting}
        />
      )}
    </>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function VaccinationParamTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <VaccineCatalogSection />
      <VaccineScheduleSection />
    </div>
  );
}
