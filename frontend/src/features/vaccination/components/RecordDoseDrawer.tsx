/**
 * RecordDoseDrawer — desktop slide-in panel for recording / viewing / editing a dose.
 * 3 modes: 'record' (new dose), 'view' (read-only ADMINISTERED), 'edit' (update with version).
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { useVaccinationCatalog } from '../hooks/useVaccinationCatalog';
import { useRecordDose } from '../hooks/useRecordDose';
import { useUpdateDose } from '../hooks/useUpdateDose';
import { RecordDoseSchema, UpdateDoseSchema } from '../schemas';
import type { RecordDoseValues, UpdateDoseValues } from '../schemas';
import type { VaccinationCalendarEntry, DrawerMode, RouteAdmin } from '../types';
import { SITE_SUGGESTIONS } from '../types';

interface RecordDoseDrawerProps {
  patientId: string;
  dose: VaccinationCalendarEntry | null;
  mode: DrawerMode;
  onClose: () => void;
}

function ViewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--border-soft)',
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 550 }}>{value ?? '—'}</span>
    </div>
  );
}

function formatForInput(isoDatetime: string | null | undefined): string {
  if (!isoDatetime) return '';
  // Convert ISO to datetime-local format "YYYY-MM-DDTHH:mm"
  return isoDatetime.slice(0, 16);
}

function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

const ROUTE_LABELS: Record<RouteAdmin, string> = {
  IM: 'IM — Intramusculaire',
  SC: 'SC — Sous-cutané',
  PO: 'PO — Per os (oral)',
  ID: 'ID — Intradermique',
};

export function RecordDoseDrawer({ patientId, dose, mode, onClose }: RecordDoseDrawerProps) {
  const { catalog } = useVaccinationCatalog();
  const recordMutation = useRecordDose(patientId);
  const updateMutation = useUpdateDose(patientId);

  const [showSiteSuggestions, setShowSiteSuggestions] = useState(false);

  const isRecord = mode === 'record';
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

  // ── Record form ────────────────────────────────────────────────────────────
  const recordForm = useForm<RecordDoseValues>({
    resolver: zodResolver(RecordDoseSchema),
    defaultValues: {
      vaccineId: dose?.vaccineId ?? '',
      doseNumber: dose?.doseNumber ?? 1,
      scheduleDoseId: dose?.scheduleDoseId ?? undefined,
      administeredAt: nowLocal(),
      lotNumber: '',
      route: dose?.vaccineId
        ? (catalog.find((c) => c.id === dose.vaccineId)?.routeDefault ?? undefined)
        : undefined,
      site: undefined,
      administeredBy: undefined,
      notes: undefined,
    },
  });

  // Update defaults when catalog loads or dose changes
  useEffect(() => {
    if (!dose) return;
    const vaccineEntry = catalog.find((c) => c.id === dose.vaccineId);
    recordForm.reset({
      vaccineId: dose.vaccineId,
      doseNumber: dose.doseNumber,
      scheduleDoseId: dose.scheduleDoseId ?? undefined,
      administeredAt: nowLocal(),
      lotNumber: '',
      route: vaccineEntry?.routeDefault ?? undefined,
      site: undefined,
      administeredBy: undefined,
      notes: undefined,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dose?.vaccineId, catalog.length]);

  // ── Edit form ──────────────────────────────────────────────────────────────
  const editForm = useForm<UpdateDoseValues>({
    resolver: zodResolver(UpdateDoseSchema),
    defaultValues: {
      vaccineId: dose?.vaccineId ?? null,
      doseNumber: dose?.doseNumber ?? null,
      administeredAt: dose?.administeredAt ? formatForInput(dose.administeredAt) : null,
      lotNumber: dose?.lotNumber ?? null,
      route: dose?.route ?? null,
      site: dose?.site ?? null,
      administeredBy: null,
      notes: dose?.notes ?? null,
      version: dose?.version ?? 0,
    },
  });

  useEffect(() => {
    if (!dose || !isEdit) return;
    editForm.reset({
      vaccineId: dose.vaccineId ?? null,
      doseNumber: dose.doseNumber ?? null,
      administeredAt: dose.administeredAt ? formatForInput(dose.administeredAt) : null,
      lotNumber: dose.lotNumber ?? null,
      route: dose.route ?? null,
      site: dose.site ?? null,
      administeredBy: null,
      notes: dose.notes ?? null,
      version: dose.version ?? 0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dose, isEdit]);

  async function handleRecord(values: RecordDoseValues) {
    try {
      await recordMutation.mutateAsync({
        vaccineId: values.vaccineId,
        doseNumber: values.doseNumber,
        ...(values.scheduleDoseId ? { scheduleDoseId: values.scheduleDoseId } : {}),
        administeredAt: new Date(values.administeredAt).toISOString(),
        lotNumber: values.lotNumber,
        ...(values.route !== undefined ? { route: values.route } : {}),
        ...(values.site !== undefined ? { site: values.site } : {}),
        ...(values.administeredBy !== undefined ? { administeredBy: values.administeredBy } : {}),
        ...(values.notes !== undefined ? { notes: values.notes } : {}),
      });
      toast.success('Dose enregistrée.');
      onClose();
    } catch {
      toast.error('Erreur lors de l\'enregistrement de la dose.');
    }
  }

  async function handleEdit(values: UpdateDoseValues) {
    if (!dose?.id) return;
    try {
      await updateMutation.mutateAsync({
        doseId: dose.id,
        body: {
          vaccineId: values.vaccineId ?? null,
          doseNumber: values.doseNumber ?? null,
          administeredAt: values.administeredAt
            ? new Date(values.administeredAt).toISOString()
            : null,
          lotNumber: values.lotNumber ?? null,
          route: values.route ?? null,
          site: values.site ?? null,
          administeredBy: values.administeredBy ?? null,
          notes: values.notes ?? null,
          version: values.version,
        },
      });
      toast.success('Dose modifiée.');
      onClose();
    } catch {
      // 409 is handled inside useUpdateDose with toast
    }
  }

  const title =
    mode === 'record'
      ? `Saisir dose — ${dose?.vaccineName ?? ''}`
      : mode === 'edit'
      ? `Modifier dose — ${dose?.vaccineName ?? ''}`
      : `Dose — ${dose?.vaccineName ?? ''}`;

  return (
    <Panel
      style={{
        width: 420,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--primary)',
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 20,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{title}</span>
        <Button variant="ghost" size="sm" iconOnly aria-label="Fermer" onClick={onClose}>
          <Close />
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* ── VIEW MODE ──────────────────────────────────────────────────────── */}
        {isView && dose && (
          <div>
            <ViewRow label="Vaccin" value={dose.vaccineName} />
            <ViewRow label="Dose" value={dose.doseLabel} />
            <ViewRow
              label="Date administrée"
              value={
                dose.administeredAt
                  ? new Date(dose.administeredAt).toLocaleString('fr-MA', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : null
              }
            />
            <ViewRow label="Lot" value={dose.lotNumber} />
            <ViewRow label="Voie" value={dose.route ?? null} />
            <ViewRow label="Site" value={dose.site ?? null} />
            <ViewRow label="Administré par" value={dose.administeredByName} />
            <ViewRow label="Notes" value={dose.notes} />
          </div>
        )}

        {/* ── RECORD MODE ────────────────────────────────────────────────────── */}
        {isRecord && (
          <form
            onSubmit={(e) => {
              void recordForm.handleSubmit(handleRecord)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            id="record-dose-form"
          >
            <div>
              <label
                htmlFor="rd-vaccineId"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Vaccin
              </label>
              <select
                id="rd-vaccineId"
                {...recordForm.register('vaccineId')}
                style={{
                  width: '100%',
                  height: 34,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '0 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="">Sélectionner un vaccin…</option>
                {catalog.filter((v) => v.active).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nameFr} ({v.code})
                  </option>
                ))}
              </select>
              {recordForm.formState.errors.vaccineId && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {recordForm.formState.errors.vaccineId.message}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="rd-doseNumber"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Numéro de dose
              </label>
              <Input
                id="rd-doseNumber"
                type="number"
                min={1}
                {...recordForm.register('doseNumber', { valueAsNumber: true })}
              />
              {recordForm.formState.errors.doseNumber && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {recordForm.formState.errors.doseNumber.message}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="rd-administeredAt"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Date et heure *
              </label>
              <Input
                id="rd-administeredAt"
                type="datetime-local"
                {...recordForm.register('administeredAt')}
              />
              {recordForm.formState.errors.administeredAt && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {recordForm.formState.errors.administeredAt.message}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="rd-lotNumber"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Numéro de lot *
              </label>
              <Input
                id="rd-lotNumber"
                placeholder="Ex. ABC123"
                {...recordForm.register('lotNumber')}
              />
              {recordForm.formState.errors.lotNumber && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {recordForm.formState.errors.lotNumber.message}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="rd-route"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Voie d&apos;administration
              </label>
              <select
                id="rd-route"
                {...recordForm.register('route')}
                style={{
                  width: '100%',
                  height: 34,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '0 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="">—</option>
                {(Object.entries(ROUTE_LABELS) as [RouteAdmin, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="rd-site"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Site d&apos;injection
              </label>
              <div style={{ position: 'relative' }}>
                <Input
                  id="rd-site"
                  placeholder="Ex. Deltoïde G"
                  {...recordForm.register('site')}
                  onFocus={() => setShowSiteSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSiteSuggestions(false), 150)}
                  autoComplete="off"
                />
                {showSiteSuggestions && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  >
                    {SITE_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={() => {
                          recordForm.setValue('site', s);
                          setShowSiteSuggestions(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          fontSize: 13,
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          color: 'var(--ink)',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="rd-notes"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Notes
              </label>
              <textarea
                id="rd-notes"
                {...recordForm.register('notes')}
                placeholder="Observations, réactions…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 70,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                  resize: 'vertical',
                  background: 'var(--surface)',
                }}
              />
            </div>
          </form>
        )}

        {/* ── EDIT MODE ──────────────────────────────────────────────────────── */}
        {isEdit && (
          <form
            onSubmit={(e) => {
              void editForm.handleSubmit(handleEdit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            id="edit-dose-form"
          >
            <div>
              <label
                htmlFor="ed-administeredAt"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Date et heure
              </label>
              <Input
                id="ed-administeredAt"
                type="datetime-local"
                {...editForm.register('administeredAt')}
              />
            </div>

            <div>
              <label
                htmlFor="ed-lotNumber"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Numéro de lot
              </label>
              <Input
                id="ed-lotNumber"
                placeholder="Ex. ABC123"
                {...editForm.register('lotNumber')}
              />
              {editForm.formState.errors.lotNumber && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {editForm.formState.errors.lotNumber.message}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="ed-route"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Voie d&apos;administration
              </label>
              <select
                id="ed-route"
                {...editForm.register('route')}
                style={{
                  width: '100%',
                  height: 34,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '0 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  color: 'var(--ink)',
                }}
              >
                <option value="">—</option>
                {(Object.entries(ROUTE_LABELS) as [RouteAdmin, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ed-site"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Site d&apos;injection
              </label>
              <Input
                id="ed-site"
                placeholder="Ex. Deltoïde G"
                {...editForm.register('site')}
              />
            </div>

            <div>
              <label
                htmlFor="ed-notes"
                style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
              >
                Notes
              </label>
              <textarea
                id="ed-notes"
                {...editForm.register('notes')}
                placeholder="Observations, réactions…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  height: 70,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                  resize: 'vertical',
                  background: 'var(--surface)',
                }}
              />
            </div>

            {/* Hidden version field */}
            <input type="hidden" {...editForm.register('version', { valueAsNumber: true })} />
          </form>
        )}
      </div>

      {/* Footer */}
      {!isView && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
          }}
        >
          <Button
            type="submit"
            form={isRecord ? 'record-dose-form' : 'edit-dose-form'}
            variant="primary"
            disabled={recordMutation.isPending || updateMutation.isPending}
            style={{ flex: 1 }}
          >
            {recordMutation.isPending || updateMutation.isPending
              ? 'Enregistrement…'
              : isRecord
              ? 'Enregistrer la dose'
              : 'Enregistrer les modifications'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      )}

      {isView && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <Button variant="ghost" onClick={onClose} style={{ width: '100%' }}>
            Fermer
          </Button>
        </div>
      )}
    </Panel>
  );
}
