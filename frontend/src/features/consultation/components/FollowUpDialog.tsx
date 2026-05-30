/**
 * Modale "Prochain RDV" — créé un RDV de contrôle (CONTROLE) lié à la
 * consultation courante via POST /api/consultations/{id}/follow-up.
 *
 * Affiche en parallèle le planning complet du jour sélectionné (vision 360)
 * pour aider le praticien à choisir un créneau libre. Détecte les chevauchements.
 */
import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: string;
  onCreated?: () => void;
}

interface ReasonView {
  id: string;
  code: string;
  label: string;
  durationMinutes: number;
  colorHex: string | null;
}

interface DayAppointment {
  id: string;
  patientId: string;
  patientFullName: string | null;
  reasonLabel: string | null;
  startAt: string;
  endAt: string;
  status: string;
}

const APT_STATUSES = new Set([
  'PLANIFIE', 'CONFIRME', 'ARRIVE', 'EN_ATTENTE_CONSTANTES', 'CONSTANTES_PRISES',
  'EN_CONSULTATION', 'TERMINE', 'CLOS', 'ANNULE',
]);

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function FollowUpDialog({ open, onOpenChange, consultationId, onCreated }: FollowUpDialogProps) {
  const { t } = useT();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('09:00');
  const [reasonId, setReasonId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isNarrow, setIsNarrow] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 820 : false,
  );

  useEffect(() => {
    if (open) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDate(d.toISOString().slice(0, 10));
      setTime('09:00');
      setNotes('');
    }
  }, [open]);

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 820);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { data: reasons = [] } = useQuery<ReasonView[]>({
    queryKey: ['scheduling-reasons'],
    queryFn: () => api.get<ReasonView[]>('/reasons').then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (reasons.length > 0 && !reasonId) {
      // Un RDV de contrôle doit porter le motif « Contrôle » : sinon le filtre
      // « motif = Contrôle » de l'agenda ne remonte jamais ces RDV (ils étaient
      // taggés « Consultation de suivi » faute de priorité). On vise donc d'abord
      // le motif code CONTROLE / libellé « Contrôle », puis « suivi », puis le 1er.
      const ctrl =
        reasons.find((r) => /^CONTROL/i.test(r.code) || /contr[oô]le/i.test(r.label)) ??
        reasons.find((r) => /suivi/i.test(r.label) || /SUIVI/i.test(r.code)) ??
        reasons[0];
      setReasonId(ctrl?.id ?? '');
    }
  }, [reasons, reasonId]);

  const dayBounds = useMemo(() => {
    if (!date) return null;
    const from = new Date(`${date}T00:00:00`);
    const to = new Date(`${date}T23:59:59.999`);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [date]);

  const { data: dayAppointments = [], isLoading: loadingDay } = useQuery<DayAppointment[]>({
    queryKey: ['day-appointments', userId, dayBounds?.from],
    queryFn: () =>
      api
        .get<DayAppointment[]>(
          `/appointments?practitionerId=${userId}&from=${encodeURIComponent(dayBounds!.from)}&to=${encodeURIComponent(dayBounds!.to)}`,
        )
        .then((r) => r.data),
    enabled: open && !!userId && !!dayBounds,
    staleTime: 30_000,
  });

  const sortedAppointments = useMemo(
    () => [...dayAppointments].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [dayAppointments],
  );

  const candidateDuration = useMemo(() => {
    const r = reasons.find((x) => x.id === reasonId);
    return r?.durationMinutes ?? 15;
  }, [reasons, reasonId]);

  const candidate = useMemo(() => {
    if (!date || !time) return null;
    const start = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + candidateDuration * 60_000);
    return { start, end };
  }, [date, time, candidateDuration]);

  const overlap = useMemo(() => {
    if (!candidate) return null;
    return sortedAppointments.find((a) => {
      if (a.status === 'ANNULE') return false;
      const s = new Date(a.startAt).getTime();
      const e = new Date(a.endAt).getTime();
      return candidate.start.getTime() < e && candidate.end.getTime() > s;
    }) ?? null;
  }, [candidate, sortedAppointments]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/consultations/${consultationId}/follow-up`, {
        date,
        time: time.length === 5 ? time + ':00' : time,
        reasonId: reasonId || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      // Same invalidation set as useCreateAppointment — without this, the
      // freshly-booked follow-up doesn't surface in the agenda's week / month
      // views nor refresh the slot picker, and the user sees "the count went
      // up but I can't find the RDV".
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['appointments-month'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      void queryClient.invalidateQueries({ queryKey: ['day-appointments'] });
    },
  });

  async function submit() {
    if (!date || !time) {
      toast.error(t('consult.followUp.dateTimeRequired'));
      return;
    }
    try {
      await mutation.mutateAsync();
      toast.success(t('consult.followUp.created'));
      onCreated?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t('consult.followUp.createRefused');
      toast.error(msg);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: 22,
            width: isNarrow ? 'min(440px, 92vw)' : 'min(820px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              {t('consult.followUp.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
            {t('consult.followUp.description')}
          </Dialog.Description>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr',
              gap: 18,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{t('consult.followUp.date')}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{t('consult.followUp.time')}</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{
                      width: '100%',
                      height: 36,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 10px',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{t('consult.followUp.reason')}</label>
              <Select
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
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
                <option value="">{t('consult.followUp.reasonChoose')}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {t('consult.followUp.reasonMinutes', { label: r.label, min: r.durationMinutes })}
                  </option>
                ))}
              </Select>

              <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{t('consult.followUp.notes')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('consult.followUp.notesPlaceholder')}
                rows={3}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />

              {overlap && (
                <div
                  role="alert"
                  style={{
                    background: 'var(--danger-soft, #fee2e2)',
                    color: 'var(--danger, #b91c1c)',
                    border: '1px solid var(--danger, #b91c1c)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 12,
                  }}
                >
                  {t('consult.followUp.overlap', {
                    name: overlap.patientFullName ?? '—',
                    start: fmtTime(overlap.startAt),
                    end: fmtTime(overlap.endAt),
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                background: 'var(--bg-muted, #fafafa)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 220,
              }}
              data-testid="day-planning"
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 12.5, color: 'var(--ink-1)' }}>
                  {t('consult.followUp.planningOf', { date: date || '—' })}
                </strong>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {t('consult.followUp.rdvCount', { n: sortedAppointments.length })}
                </span>
              </div>

              {loadingDay && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('common.loading')}</div>
              )}

              {!loadingDay && sortedAppointments.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  {t('consult.followUp.noRdvFree')}
                </div>
              )}

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {sortedAppointments.map((a) => {
                  const conflict = overlap?.id === a.id;
                  return (
                    <li
                      key={a.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '78px 1fr auto',
                        gap: 8,
                        alignItems: 'center',
                        padding: '6px 8px',
                        borderRadius: 6,
                        background: conflict ? 'var(--danger-soft, #fee2e2)' : 'var(--surface)',
                        border: conflict
                          ? '1px solid var(--danger, #b91c1c)'
                          : '1px solid var(--border)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                        {fmtTime(a.startAt)}–{fmtTime(a.endAt)}
                      </span>
                      <span style={{ color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.patientFullName ?? '—'}
                        {a.reasonLabel ? (
                          <span style={{ color: 'var(--ink-3)' }}> · {a.reasonLabel}</span>
                        ) : null}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                        {APT_STATUSES.has(a.status) ? t(`consult.aptStatus.${a.status}`) : a.status}
                      </span>
                    </li>
                  );
                })}

                {candidate && (
                  <li
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '78px 1fr auto',
                      gap: 8,
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: overlap ? 'transparent' : 'var(--accent-soft, #ecfeff)',
                      border: '1px dashed var(--accent, #0891b2)',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                    data-testid="candidate-slot"
                  >
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmtTime(candidate.start.toISOString())}–{fmtTime(candidate.end.toISOString())}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--accent, #0891b2)' }}>
                      {t('consult.followUp.newRdv')}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{t('consult.followUp.minutes', { n: candidateDuration })}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <Dialog.Close asChild>
              <Button>{t('common.cancel')}</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? t('consult.followUp.scheduling') : t('consult.followUp.schedule')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
