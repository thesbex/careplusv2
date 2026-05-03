/**
 * VaccinationCalendarTab — desktop tab content for the vaccination module.
 * Vertical timeline grouped by age section (Naissance → Hors calendrier).
 * Status colors follow design/prototype/DESIGN_SYSTEM.md §2 tokens.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Print } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useVaccinationCalendar } from '../hooks/useVaccinationCalendar';
import { useDeferDose } from '../hooks/useDeferDose';
import { useSkipDose } from '../hooks/useSkipDose';
import { useDeleteDose } from '../hooks/useDeleteDose';
import { useDownloadBooklet } from '../hooks/useDownloadBooklet';
import { DoseCard } from './DoseCard';
import { RecordDoseDrawer } from './RecordDoseDrawer';
import type { VaccinationCalendarEntry, AgeGroup, DrawerMode } from '../types';
import { AGE_GROUP_LABEL } from '../types';
import { useAuthStore } from '@/lib/auth/authStore';
import { DeferDoseSchema } from '../schemas';
import type { DeferDoseValues } from '../schemas';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// ── Age-group classification ────────────────────────────────────────────────
// Based on targetDate vs patient birth date estimated from age ranges in PNI:
// Naissance: 0-15 days, 2 mois: 16-75 days, 4 mois: 76-150 days,
// 12 mois: 151-400 days, 18 mois: 401-650 days, 5 ans: 651-2200 days,
// 11 ans: 2201-5000 days, hors-calendrier: doses with no scheduleDoseId

function classifyAgeGroup(dose: VaccinationCalendarEntry): AgeGroup {
  if (!dose.scheduleDoseId) return 'hors-calendrier';
  // Use doseLabel hints to assign group
  const label = dose.doseLabel.toLowerCase();
  if (label.includes('naissance') || label.includes('j0') || label.includes('0 mois')) {
    return 'naissance';
  }
  if (label.includes('2 mois') || label.includes('2m')) return '2-mois';
  if (label.includes('4 mois') || label.includes('4m')) return '4-mois';
  if (label.includes('12 mois') || label.includes('12m') || label.includes('1 an')) return '12-mois';
  if (label.includes('18 mois') || label.includes('18m')) return '18-mois';
  if (label.includes('5 ans') || label.includes('5a')) return '5-ans';
  if (label.includes('11 ans') || label.includes('11a') || label.includes('hpv')) return '11-ans';
  return 'naissance'; // fallback for unrecognised PNI labels
}

function groupByAge(
  calendar: VaccinationCalendarEntry[],
): Map<AgeGroup, VaccinationCalendarEntry[]> {
  const ORDER: AgeGroup[] = [
    'naissance', '2-mois', '4-mois', '12-mois', '18-mois', '5-ans', '11-ans', 'hors-calendrier',
  ];
  const map = new Map<AgeGroup, VaccinationCalendarEntry[]>(ORDER.map((g) => [g, []]));
  for (const dose of calendar) {
    const group = classifyAgeGroup(dose);
    const arr = map.get(group);
    if (arr) arr.push(dose);
  }
  return map;
}

// ── Defer mini-modal (inline) ────────────────────────────────────────────────

interface DeferModalProps {
  dose: VaccinationCalendarEntry;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function DeferModal({ dose, onConfirm, onCancel, isPending }: DeferModalProps) {
  const form = useForm<DeferDoseValues>({
    resolver: zodResolver(DeferDoseSchema),
    defaultValues: { reason: '' },
  });

  function handleSubmit(values: DeferDoseValues) {
    onConfirm(values.reason);
  }

  return (
    <div
      role="dialog"
      aria-label="Reporter la dose"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          padding: 20,
          width: 400,
          maxWidth: '90vw',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Reporter la dose
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}>
          {dose.vaccineName} — {dose.doseLabel}
        </div>
        <form onSubmit={(e) => { void form.handleSubmit(handleSubmit)(e); }}>
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="defer-reason"
              style={{ fontSize: 12, fontWeight: 550, color: 'var(--ink-2)', display: 'block', marginBottom: 4 }}
            >
              Motif de report *
            </label>
            <textarea
              id="defer-reason"
              {...form.register('reason')}
              placeholder="Ex. Fièvre, contre-indication temporaire…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: 80,
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
            {form.formState.errors.reason && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {form.formState.errors.reason.message}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Report…' : 'Reporter'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface VaccinationCalendarTabProps {
  patientId: string;
}

export function VaccinationCalendarTab({ patientId }: VaccinationCalendarTabProps) {
  const { calendar, isLoading, error } = useVaccinationCalendar(patientId);
  const { download: downloadBooklet, isLoading: isBookletLoading } = useDownloadBooklet(patientId);
  const deferMutation = useDeferDose(patientId);
  const skipMutation = useSkipDose(patientId);
  const deleteMutation = useDeleteDose(patientId);

  const [drawerDose, setDrawerDose] = useState<VaccinationCalendarEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('record');
  const [deferDose, setDeferDose] = useState<VaccinationCalendarEntry | null>(null);

  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const canRecord = roles.some((r) => ['MEDECIN', 'ASSISTANT', 'ADMIN'].includes(r));
  const canAdmin = roles.some((r) => ['MEDECIN', 'ADMIN'].includes(r));

  function openDrawer(dose: VaccinationCalendarEntry, mode: DrawerMode) {
    setDrawerDose(dose);
    setDrawerMode(mode);
  }

  function closeDrawer() {
    setDrawerDose(null);
  }

  async function handleDefer(dose: VaccinationCalendarEntry, reason: string) {
    const doseId = dose.id;
    if (!doseId) {
      toast.error('Cette dose n\'a pas encore d\'identifiant. Rechargez la page.');
      return;
    }
    try {
      await deferMutation.mutateAsync({ doseId, body: { reason } });
      toast.success('Dose reportée.');
      setDeferDose(null);
    } catch {
      toast.error('Erreur lors du report de la dose.');
    }
  }

  async function handleSkip(dose: VaccinationCalendarEntry) {
    if (!dose.id) {
      toast.error('Cette dose n\'a pas encore d\'identifiant. Rechargez la page.');
      return;
    }
    if (!confirm(`Marquer "${dose.vaccineName} — ${dose.doseLabel}" comme non administrée ?`)) {
      return;
    }
    try {
      await skipMutation.mutateAsync(dose.id);
      toast.success('Dose marquée comme non administrée.');
    } catch {
      toast.error('Erreur lors de l\'opération.');
    }
  }

  async function handleDelete(dose: VaccinationCalendarEntry) {
    if (!dose.id) return;
    if (!confirm(`Supprimer la dose "${dose.vaccineName} — ${dose.doseLabel}" ?`)) return;
    try {
      await deleteMutation.mutateAsync(dose.id);
      toast.success('Dose supprimée.');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  }

  // ── States: loading / error / empty ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div
          style={{
            height: 120,
            background: 'var(--bg-alt)',
            borderRadius: 'var(--r-md)',
            animation: 'pulse 1.4s infinite',
          }}
          aria-label="Chargement du calendrier vaccinal…"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px 24px', color: 'var(--danger)', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  const grouped = groupByAge(calendar);
  const hasAny = calendar.length > 0;

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', flex: 1, overflowY: 'auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          paddingBottom: 14,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Vaccination</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            Carnet PNI marocain
          </div>
        </div>
        <Button
          onClick={() => { void downloadBooklet(); }}
          disabled={isBookletLoading}
          size="sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Print style={{ width: 13, height: 13 }} />
          {isBookletLoading ? 'Chargement…' : 'Imprimer carnet'}
        </Button>
      </div>

      {/* Empty state */}
      {!hasAny && (
        <div
          style={{
            padding: '40px 0',
            textAlign: 'center',
            color: 'var(--ink-3)',
            fontSize: 13,
          }}
        >
          Patient hors plage pédiatrique — pas de calendrier vaccinal applicable.
        </div>
      )}

      {/* Timeline by age group */}
      {hasAny && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {Array.from(grouped.entries()).map(([group, doses]) => {
            if (doses.length === 0) return null;
            return (
              <div key={group} style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
                {/* Left: age label + vertical line */}
                <div
                  style={{
                    width: 80,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    paddingRight: 16,
                    paddingTop: 2,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 650,
                      color: 'var(--primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      textAlign: 'right',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {AGE_GROUP_LABEL[group]}
                  </div>
                </div>

                {/* Vertical line connector */}
                <div
                  style={{
                    width: 2,
                    background: 'var(--primary-soft)',
                    borderRadius: 1,
                    flexShrink: 0,
                    marginRight: 16,
                    alignSelf: 'stretch',
                  }}
                />

                {/* Right: dose cards */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {doses.map((dose, idx) => (
                    <DoseCard
                      key={dose.id ?? `${dose.vaccineCode}-${dose.doseNumber}-${idx}`}
                      dose={dose}
                      canRecord={canRecord}
                      canAdmin={canAdmin}
                      onRecord={openDrawer}
                      onDefer={(d) => setDeferDose(d)}
                      onSkip={(d) => { void handleSkip(d); }}
                      onDelete={(d) => { void handleDelete(d); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-in drawer */}
      {drawerDose && (
        <RecordDoseDrawer
          patientId={patientId}
          dose={drawerDose}
          mode={drawerMode}
          onClose={closeDrawer}
        />
      )}

      {/* Defer modal */}
      {deferDose && (
        <DeferModal
          dose={deferDose}
          onConfirm={(reason) => { void handleDefer(deferDose, reason); }}
          onCancel={() => setDeferDose(null)}
          isPending={deferMutation.isPending}
        />
      )}
    </div>
  );
}
