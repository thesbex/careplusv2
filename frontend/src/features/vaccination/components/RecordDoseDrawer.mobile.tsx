/**
 * RecordDoseDrawer (mobile) — fullscreen slide-up sheet for recording/viewing/editing a dose.
 * Pattern: Vaul Drawer, matching mobile bottom-sheet conventions from DESIGN_SYSTEM.md §7.
 */
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Drawer } from 'vaul';
import { useVaccinationCatalog } from '../hooks/useVaccinationCatalog';
import { useRecordDose } from '../hooks/useRecordDose';
import { useUpdateDose } from '../hooks/useUpdateDose';
import { RecordDoseSchema, UpdateDoseSchema } from '../schemas';
import type { RecordDoseValues, UpdateDoseValues } from '../schemas';
import type { VaccinationCalendarEntry, DrawerMode, RouteAdmin } from '../types';
import { SITE_SUGGESTIONS } from '../types';

interface RecordDoseDrawerMobileProps {
  patientId: string;
  dose: VaccinationCalendarEntry | null;
  mode: DrawerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROUTE_LABELS: Record<RouteAdmin, string> = {
  IM: 'IM — Intramusculaire',
  SC: 'SC — Sous-cutané',
  PO: 'PO — Per os (oral)',
  ID: 'ID — Intradermique',
};

function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function formatForInput(isoDatetime: string | null | undefined): string {
  if (!isoDatetime) return '';
  return isoDatetime.slice(0, 16);
}

function MLbl({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink-2)', marginBottom: 6 }}>
      {children}
    </div>
  );
}

function MViewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--border-soft)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 550 }}>{value ?? '—'}</span>
    </div>
  );
}

export function RecordDoseDrawerMobile({
  patientId,
  dose,
  mode,
  open,
  onOpenChange,
}: RecordDoseDrawerMobileProps) {
  const { catalog } = useVaccinationCatalog();
  const recordMutation = useRecordDose(patientId);
  const updateMutation = useUpdateDose(patientId);

  const [showSuggestions, setShowSuggestions] = useState(false);

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
      route: undefined,
      site: undefined,
      administeredBy: undefined,
      notes: undefined,
    },
  });

  useEffect(() => {
    if (!dose || !open) return;
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
  }, [dose?.vaccineId, open, catalog.length]);

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
    if (!dose || !isEdit || !open) return;
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
  }, [dose, isEdit, open]);

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
        ...(values.notes !== undefined ? { notes: values.notes } : {}),
      });
      toast.success('Dose enregistrée.');
      onOpenChange(false);
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
      onOpenChange(false);
    } catch {
      // 409 handled in useUpdateDose
    }
  }

  const title =
    mode === 'record'
      ? `Saisir dose — ${dose?.vaccineName ?? ''}`
      : mode === 'edit'
      ? `Modifier dose — ${dose?.vaccineName ?? ''}`
      : `Dose — ${dose?.vaccineName ?? ''}`;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box' as const,
    height: 46,
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '0 14px',
    fontSize: 15,
    fontFamily: 'inherit',
    color: 'var(--ink)',
    background: 'var(--surface)',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'auto',
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 40,
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--surface)',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90dvh',
          }}
          aria-label={title}
        >
          {/* Grab handle */}
          <div
            style={{
              width: 36,
              height: 4,
              background: 'var(--border-strong)',
              borderRadius: 2,
              margin: '12px auto 0',
            }}
          />

          {/* Title */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.015em',
            }}
          >
            {title}
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* VIEW MODE */}
            {isView && dose && (
              <div>
                <MViewRow label="Vaccin" value={dose.vaccineName} />
                <MViewRow label="Dose" value={dose.doseLabel} />
                <MViewRow
                  label="Date"
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
                <MViewRow label="Lot" value={dose.lotNumber} />
                <MViewRow label="Voie" value={dose.route} />
                <MViewRow label="Site" value={dose.site} />
                <MViewRow label="Par" value={dose.administeredByName} />
                <MViewRow label="Notes" value={dose.notes} />
              </div>
            )}

            {/* RECORD MODE */}
            {isRecord && (
              <form
                id="m-record-dose-form"
                onSubmit={(e) => { void recordForm.handleSubmit(handleRecord)(e); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div>
                  <MLbl>Vaccin</MLbl>
                  <select {...recordForm.register('vaccineId')} style={selectStyle}>
                    <option value="">Sélectionner un vaccin…</option>
                    {catalog.filter((v) => v.active).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nameFr} ({v.code})
                      </option>
                    ))}
                  </select>
                  {recordForm.formState.errors.vaccineId && (
                    <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>
                      {recordForm.formState.errors.vaccineId.message}
                    </div>
                  )}
                </div>

                <div>
                  <MLbl>Date et heure *</MLbl>
                  <input
                    type="datetime-local"
                    {...recordForm.register('administeredAt')}
                    style={inputStyle}
                  />
                  {recordForm.formState.errors.administeredAt && (
                    <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>
                      {recordForm.formState.errors.administeredAt.message}
                    </div>
                  )}
                </div>

                <div>
                  <MLbl>Numéro de lot *</MLbl>
                  <input
                    type="text"
                    placeholder="Ex. ABC123"
                    {...recordForm.register('lotNumber')}
                    style={inputStyle}
                  />
                  {recordForm.formState.errors.lotNumber && (
                    <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>
                      {recordForm.formState.errors.lotNumber.message}
                    </div>
                  )}
                </div>

                <div>
                  <MLbl>Voie d&apos;administration</MLbl>
                  <select {...recordForm.register('route')} style={selectStyle}>
                    <option value="">—</option>
                    {(Object.entries(ROUTE_LABELS) as [RouteAdmin, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <MLbl>Site d&apos;injection</MLbl>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Ex. Deltoïde G"
                      {...recordForm.register('site')}
                      style={inputStyle}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      autoComplete="off"
                    />
                    {showSuggestions && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-lg)',
                          zIndex: 10,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
                        }}
                      >
                        {SITE_SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={() => {
                              recordForm.setValue('site', s);
                              setShowSuggestions(false);
                            }}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 16px',
                              fontSize: 15,
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
                  <MLbl>Notes</MLbl>
                  <textarea
                    {...recordForm.register('notes')}
                    placeholder="Observations, réactions…"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: 80,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-lg)',
                      padding: '12px 14px',
                      fontSize: 15,
                      fontFamily: 'inherit',
                      color: 'var(--ink)',
                      resize: 'vertical',
                      background: 'var(--surface)',
                    }}
                  />
                </div>
              </form>
            )}

            {/* EDIT MODE */}
            {isEdit && (
              <form
                id="m-edit-dose-form"
                onSubmit={(e) => { void editForm.handleSubmit(handleEdit)(e); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                <div>
                  <MLbl>Date et heure</MLbl>
                  <input
                    type="datetime-local"
                    {...editForm.register('administeredAt')}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <MLbl>Numéro de lot</MLbl>
                  <input
                    type="text"
                    placeholder="Ex. ABC123"
                    {...editForm.register('lotNumber')}
                    style={inputStyle}
                  />
                  {editForm.formState.errors.lotNumber && (
                    <div style={{ fontSize: 13, color: 'var(--danger)', marginTop: 4 }}>
                      {editForm.formState.errors.lotNumber.message}
                    </div>
                  )}
                </div>

                <div>
                  <MLbl>Voie d&apos;administration</MLbl>
                  <select {...editForm.register('route')} style={selectStyle}>
                    <option value="">—</option>
                    {(Object.entries(ROUTE_LABELS) as [RouteAdmin, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <MLbl>Site d&apos;injection</MLbl>
                  <input
                    type="text"
                    placeholder="Ex. Deltoïde G"
                    {...editForm.register('site')}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <MLbl>Notes</MLbl>
                  <textarea
                    {...editForm.register('notes')}
                    placeholder="Observations, réactions…"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: 80,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-lg)',
                      padding: '12px 14px',
                      fontSize: 15,
                      fontFamily: 'inherit',
                      color: 'var(--ink)',
                      resize: 'vertical',
                      background: 'var(--surface)',
                    }}
                  />
                </div>

                <input type="hidden" {...editForm.register('version', { valueAsNumber: true })} />
              </form>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 16px',
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: 8,
            }}
          >
            {isRecord && (
              <button
                type="submit"
                form="m-record-dose-form"
                disabled={recordMutation.isPending}
                style={{
                  flex: 1,
                  height: 48,
                  background: 'var(--primary)',
                  color: 'var(--primary-ink)',
                  border: 'none',
                  borderRadius: 'var(--r-lg)',
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {recordMutation.isPending ? 'Enregistrement…' : 'Enregistrer la dose'}
              </button>
            )}
            {isEdit && (
              <button
                type="submit"
                form="m-edit-dose-form"
                disabled={updateMutation.isPending}
                style={{
                  flex: 1,
                  height: 48,
                  background: 'var(--primary)',
                  color: 'var(--primary-ink)',
                  border: 'none',
                  borderRadius: 'var(--r-lg)',
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={{
                height: 48,
                padding: '0 20px',
                background: 'var(--bg-alt)',
                color: 'var(--ink)',
                border: 'none',
                borderRadius: 'var(--r-lg)',
                fontSize: 15,
                fontWeight: 550,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {isView ? 'Fermer' : 'Annuler'}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
