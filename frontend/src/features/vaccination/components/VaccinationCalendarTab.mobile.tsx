/**
 * VaccinationCalendarTab (mobile) — stack vertical full-width 390px.
 * Dose cards in a single column, drawer via Vaul bottom-sheet.
 * Matches mobile bottom-sheet pattern from DESIGN_SYSTEM.md §7.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Print } from '@/components/icons';
import { useVaccinationCalendar } from '../hooks/useVaccinationCalendar';
import { useDeferDose } from '../hooks/useDeferDose';
import { useSkipDose } from '../hooks/useSkipDose';
import { useDeleteDose } from '../hooks/useDeleteDose';
import { useDownloadBooklet } from '../hooks/useDownloadBooklet';
import { RecordDoseDrawerMobile } from './RecordDoseDrawer.mobile';
import type { VaccinationCalendarEntry, AgeGroup, DrawerMode, DoseStatus } from '../types';
import { AGE_GROUP_LABEL } from '../types';
import { useAuthStore } from '@/lib/auth/authStore';

// ── Age-group classification ─────────────────────────────────────────────────

function classifyAgeGroup(dose: VaccinationCalendarEntry): AgeGroup {
  if (!dose.scheduleDoseId) return 'hors-calendrier';
  const label = dose.doseLabel.toLowerCase();
  if (label.includes('naissance') || label.includes('j0') || label.includes('0 mois')) return 'naissance';
  if (label.includes('2 mois') || label.includes('2m')) return '2-mois';
  if (label.includes('4 mois') || label.includes('4m')) return '4-mois';
  if (label.includes('12 mois') || label.includes('12m') || label.includes('1 an')) return '12-mois';
  if (label.includes('18 mois') || label.includes('18m')) return '18-mois';
  if (label.includes('5 ans') || label.includes('5a')) return '5-ans';
  if (label.includes('11 ans') || label.includes('11a') || label.includes('hpv')) return '11-ans';
  return 'naissance';
}

function groupByAge(calendar: VaccinationCalendarEntry[]): Map<AgeGroup, VaccinationCalendarEntry[]> {
  const ORDER: AgeGroup[] = ['naissance', '2-mois', '4-mois', '12-mois', '18-mois', '5-ans', '11-ans', 'hors-calendrier'];
  const map = new Map<AgeGroup, VaccinationCalendarEntry[]>(ORDER.map((g) => [g, []]));
  for (const dose of calendar) {
    const group = classifyAgeGroup(dose);
    map.get(group)?.push(dose);
  }
  return map;
}

// ── Status styling ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<DoseStatus, string> = {
  ADMINISTERED: 'var(--success)',
  DUE_SOON: 'var(--amber)',
  OVERDUE: 'var(--danger)',
  UPCOMING: 'var(--ink-4)',
  SKIPPED: 'var(--ink-4)',
  DEFERRED: 'var(--ink-3)',
};

const STATUS_BG: Record<DoseStatus, string> = {
  ADMINISTERED: 'var(--success-soft)',
  DUE_SOON: 'var(--amber-soft)',
  OVERDUE: 'var(--danger-soft)',
  UPCOMING: 'var(--surface)',
  SKIPPED: 'var(--bg-alt)',
  DEFERRED: 'var(--bg-alt)',
};

const STATUS_LABEL: Record<DoseStatus, string> = {
  ADMINISTERED: 'Administrée',
  DUE_SOON: 'Prochaine',
  OVERDUE: 'En retard',
  UPCOMING: 'Planifiée',
  SKIPPED: 'Non administrée',
  DEFERRED: 'Reportée',
};

function formatDateFR(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-MA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Mobile dose card ─────────────────────────────────────────────────────────

interface MDoseCardProps {
  dose: VaccinationCalendarEntry;
  canRecord: boolean;
  canAdmin: boolean;
  onTap: (dose: VaccinationCalendarEntry, mode: DrawerMode) => void;
  onDefer: (dose: VaccinationCalendarEntry) => void;
  onSkip: (dose: VaccinationCalendarEntry) => void;
  onDelete: (dose: VaccinationCalendarEntry) => void;
}

function MDoseCard({ dose, canRecord, canAdmin, onTap, onDefer, onSkip, onDelete }: MDoseCardProps) {
  const isActionable = dose.status === 'UPCOMING' || dose.status === 'DUE_SOON' || dose.status === 'OVERDUE';
  const isAdministered = dose.status === 'ADMINISTERED';
  const isSkipped = dose.status === 'SKIPPED';

  return (
    <div
      className="m-card"
      style={{
        marginBottom: 8,
        opacity: isSkipped ? 0.65 : 1,
      }}
    >
      <button
        type="button"
        onClick={() => onTap(dose, isAdministered ? 'view' : 'record')}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '12px 14px',
          width: '100%',
          textAlign: 'left',
          background: STATUS_BG[dose.status],
          border: 'none',
          borderRadius: 'var(--r-lg)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Color indicator */}
        <div
          style={{
            width: 3,
            alignSelf: 'stretch',
            background: STATUS_COLOR[dose.status],
            borderRadius: 2,
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
              textDecoration: isSkipped ? 'line-through' : 'none',
            }}
          >
            {dose.vaccineName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            {dose.doseLabel} · <span className="tnum">{formatDateFR(dose.targetDate)}</span>
          </div>
          {isAdministered && dose.lotNumber && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              Lot <span className="mono">{dose.lotNumber}</span>
            </div>
          )}
          {dose.status === 'DEFERRED' && dose.deferralReason && (
            <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
              Motif : {dose.deferralReason}
            </div>
          )}
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: 12,
            background: STATUS_BG[dose.status],
            color: STATUS_COLOR[dose.status],
            border: `1px solid ${STATUS_COLOR[dose.status]}`,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {STATUS_LABEL[dose.status]}
        </span>
      </button>

      {/* Action row */}
      {(isActionable || isAdministered) && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '8px 14px',
            borderTop: '1px solid var(--border-soft)',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {isActionable && canRecord && (
            <button
              type="button"
              onClick={() => onTap(dose, 'record')}
              style={{
                flexShrink: 0,
                height: 32,
                padding: '0 14px',
                borderRadius: 16,
                border: '1px solid var(--primary)',
                background: 'var(--primary)',
                color: 'var(--primary-ink)',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Saisir dose
            </button>
          )}
          {isActionable && canRecord && (
            <button
              type="button"
              onClick={() => onDefer(dose)}
              style={{
                flexShrink: 0,
                height: 32,
                padding: '0 14px',
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--ink-2)',
                fontSize: 12,
                fontWeight: 550,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Reporter
            </button>
          )}
          {isActionable && canAdmin && (
            <button
              type="button"
              onClick={() => onSkip(dose)}
              style={{
                flexShrink: 0,
                height: 32,
                padding: '0 14px',
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--ink-3)',
                fontSize: 12,
                fontWeight: 550,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Non administrée
            </button>
          )}
          {isAdministered && canAdmin && (
            <>
              <button
                type="button"
                onClick={() => onTap(dose, 'edit')}
                style={{
                  flexShrink: 0,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 16,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  fontSize: 12,
                  fontWeight: 550,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => onDelete(dose)}
                style={{
                  flexShrink: 0,
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 16,
                  border: '1px solid var(--danger)',
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Supprimer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Defer mobile sheet ───────────────────────────────────────────────────────

import { Drawer } from 'vaul';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DeferDoseSchema } from '../schemas';
import type { DeferDoseValues } from '../schemas';

interface DeferSheetProps {
  dose: VaccinationCalendarEntry;
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function DeferSheet({ dose, open, onConfirm, onCancel, isPending }: DeferSheetProps) {
  const form = useForm<DeferDoseValues>({
    resolver: zodResolver(DeferDoseSchema),
    defaultValues: { reason: '' },
  });

  function handleSubmit(values: DeferDoseValues) {
    onConfirm(values.reason);
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <Drawer.Portal>
        <Drawer.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
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
            padding: 20,
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          }}
          aria-label="Reporter la dose"
        >
          <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '0 auto 16px' }} />
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Reporter la dose</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
            {dose.vaccineName} — {dose.doseLabel}
          </div>
          <form onSubmit={(e) => { void form.handleSubmit(handleSubmit)(e); }}>
            <label
              htmlFor="m-defer-reason"
              style={{ fontSize: 13, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 8 }}
            >
              Motif de report *
            </label>
            <textarea
              id="m-defer-reason"
              {...form.register('reason')}
              placeholder="Ex. Fièvre, contre-indication temporaire…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 90,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)',
                padding: '12px 14px',
                fontSize: 15,
                fontFamily: 'inherit',
                color: 'var(--ink)',
                resize: 'none',
                background: 'var(--surface)',
                marginBottom: 8,
              }}
            />
            {form.formState.errors.reason && (
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
                {form.formState.errors.reason.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={isPending}
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
                {isPending ? 'Report…' : 'Reporter'}
              </button>
              <button
                type="button"
                onClick={onCancel}
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
                Annuler
              </button>
            </div>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// ── Main mobile component ────────────────────────────────────────────────────

interface VaccinationCalendarTabMobileProps {
  patientId: string;
}

export function VaccinationCalendarTabMobile({ patientId }: VaccinationCalendarTabMobileProps) {
  const { calendar, isLoading, error } = useVaccinationCalendar(patientId);
  const { download: downloadBooklet, isLoading: isBookletLoading } = useDownloadBooklet(patientId);
  const deferMutation = useDeferDose(patientId);
  const skipMutation = useSkipDose(patientId);
  const deleteMutation = useDeleteDose(patientId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDose, setDrawerDose] = useState<VaccinationCalendarEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('record');
  const [deferOpen, setDeferOpen] = useState(false);
  const [deferDose, setDeferDose] = useState<VaccinationCalendarEntry | null>(null);

  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const canRecord = roles.some((r) => ['MEDECIN', 'ASSISTANT', 'ADMIN'].includes(r));
  const canAdmin = roles.some((r) => ['MEDECIN', 'ADMIN'].includes(r));

  function openDrawer(dose: VaccinationCalendarEntry, mode: DrawerMode) {
    setDrawerDose(dose);
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  function openDefer(dose: VaccinationCalendarEntry) {
    setDeferDose(dose);
    setDeferOpen(true);
  }

  async function handleDefer(reason: string) {
    if (!deferDose?.id) return;
    try {
      await deferMutation.mutateAsync({ doseId: deferDose.id, body: { reason } });
      toast.success('Dose reportée.');
      setDeferOpen(false);
      setDeferDose(null);
    } catch {
      toast.error('Erreur lors du report.');
    }
  }

  async function handleSkip(dose: VaccinationCalendarEntry) {
    if (!dose.id) return;
    if (!confirm(`Marquer "${dose.vaccineName}" comme non administrée ?`)) return;
    try {
      await skipMutation.mutateAsync(dose.id);
      toast.success('Dose marquée comme non administrée.');
    } catch {
      toast.error('Erreur lors de l\'opération.');
    }
  }

  async function handleDelete(dose: VaccinationCalendarEntry) {
    if (!dose.id) return;
    if (!confirm(`Supprimer la dose "${dose.vaccineName}" ?`)) return;
    try {
      await deleteMutation.mutateAsync(dose.id);
      toast.success('Dose supprimée.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  }

  // ── Loading / error / empty ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: '16px' }}>
        <div
          style={{
            height: 80,
            background: 'var(--bg-alt)',
            borderRadius: 'var(--r-lg)',
            marginBottom: 10,
          }}
          aria-label="Chargement…"
        />
        <div style={{ height: 80, background: 'var(--bg-alt)', borderRadius: 'var(--r-lg)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', color: 'var(--danger)', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  const grouped = groupByAge(calendar);
  const hasAny = calendar.length > 0;

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Vaccination</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          Carnet PNI marocain
        </div>
      </div>

      {/* Empty state */}
      {!hasAny && (
        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
          Patient hors plage pédiatrique — pas de calendrier vaccinal applicable.
        </div>
      )}

      {/* Dose cards grouped by age */}
      {hasAny && (
        <div style={{ padding: '12px 16px' }}>
          {Array.from(grouped.entries()).map(([group, doses]) => {
            if (doses.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 650,
                    color: 'var(--primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 8,
                    paddingLeft: 2,
                  }}
                >
                  {AGE_GROUP_LABEL[group]}
                </div>
                {doses.map((dose, idx) => (
                  <MDoseCard
                    key={dose.id ?? `${dose.vaccineCode}-${dose.doseNumber}-${idx}`}
                    dose={dose}
                    canRecord={canRecord}
                    canAdmin={canAdmin}
                    onTap={openDrawer}
                    onDefer={openDefer}
                    onSkip={(d) => { void handleSkip(d); }}
                    onDelete={(d) => { void handleDelete(d); }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Imprimer carnet button */}
      <div
        style={{
          position: 'fixed',
          bottom: 76, // above MTabs (76h)
          left: 0,
          right: 0,
          padding: '10px 16px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          disabled={isBookletLoading}
          onClick={() => { void downloadBooklet(); }}
          style={{
            width: '100%',
            height: 44,
            background: 'var(--bg-alt)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            color: 'var(--ink-2)',
          }}
        >
          <Print style={{ width: 14, height: 14 }} />
          {isBookletLoading ? 'Chargement…' : 'Imprimer carnet'}
        </button>
      </div>

      {/* Dose drawer */}
      <RecordDoseDrawerMobile
        patientId={patientId}
        dose={drawerDose}
        mode={drawerMode}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      {/* Defer sheet */}
      {deferDose && (
        <DeferSheet
          dose={deferDose}
          open={deferOpen}
          onConfirm={(reason) => { void handleDefer(reason); }}
          onCancel={() => { setDeferOpen(false); setDeferDose(null); }}
          isPending={deferMutation.isPending}
        />
      )}
    </div>
  );
}
