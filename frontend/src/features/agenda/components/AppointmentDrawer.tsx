/**
 * AppointmentDrawer — opens on click of an agenda block. Shows details,
 * lets the user move (date+time+duration) / cancel (with reason) / check-in.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { useCheckIn } from '@/features/salle-attente/hooks/useCheckIn';
import {
  useMoveAppointment,
  useCancelAppointment,
  extractConflictMessage,
} from '../hooks/useAppointmentMutations';
import type { Appointment } from '../types';

interface AppointmentDrawerProps {
  open: boolean;
  appointment: Appointment | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

function isoToLocalParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` };
}

function partsToIso(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`);
  return local.toISOString();
}

export function AppointmentDrawer({
  open,
  appointment,
  onOpenChange,
  onChanged,
}: AppointmentDrawerProps) {
  const navigate = useNavigate();
  const { moveAppointment, isPending: isMoving } = useMoveAppointment();
  const { cancelAppointment, isPending: isCancelling } = useCancelAppointment();
  const { checkIn, isPending: isCheckingIn } = useCheckIn();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (appointment?.startAt) {
      const { date: d, time: t } = isoToLocalParts(appointment.startAt);
      setDate(d);
      setTime(t);
      setDuration(appointment.durationMinutes ?? appointment.dur);
    }
    if (!open) {
      setShowCancel(false);
      setCancelReason('');
    }
  }, [appointment, open]);

  if (!appointment) return null;
  const a = appointment;
  const id = a.id;
  const canMutate = !!id;
  const canCheckIn =
    canMutate && (a.rawStatus === 'PLANIFIE' || a.rawStatus === 'CONFIRME');

  async function handleMove() {
    if (!id) return;
    try {
      await moveAppointment({
        id,
        startAt: partsToIso(date, time),
        durationMinutes: duration,
      });
      toast.success('RDV déplacé.');
      onChanged?.();
      onOpenChange(false);
    } catch (err) {
      const msg = extractConflictMessage(err);
      if (msg) toast.error(msg);
      else toast.error('Déplacement refusé.');
    }
  }

  async function handleCancel() {
    if (!id) return;
    if (cancelReason.trim().length < 3) {
      toast.error('Raison requise (3 caractères min).');
      return;
    }
    try {
      await cancelAppointment({ id, reason: cancelReason });
      toast.success('RDV annulé.');
      onChanged?.();
      onOpenChange(false);
    } catch {
      toast.error('Annulation refusée.');
    }
  }

  async function handleCheckIn() {
    if (!id) return;
    try {
      await checkIn(id);
      toast.success('Arrivée déclarée.');
      onChanged?.();
      onOpenChange(false);
      void navigate('/salle');
    } catch {
      toast.error('Check-in refusé.');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,0.25)', zIndex: 100 }}
        />
        <Dialog.Content
          aria-label="Détails du rendez-vous"
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 480,
            maxWidth: '100vw',
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            boxShadow: '-16px 0 40px rgba(0,0,0,0.1)',
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {a.patient}
              </Dialog.Title>
              <Dialog.Description
                style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0, marginTop: 2 }}
              >
                {a.reason} · {a.start} ({a.dur}min)
                {a.rawStatus ? ` · ${a.rawStatus}` : ''}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {!canMutate && (
              <div
                style={{
                  padding: 12,
                  background: 'var(--amber-soft)',
                  border: '1px solid #E8CFA9',
                  color: 'var(--amber)',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                Cet élément vient d&apos;une fixture — actions désactivées.
              </div>
            )}

            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--ink-3)',
                marginBottom: 8,
              }}
            >
              Déplacer
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                Date
                <input
                  type="date"
                  value={date}
                  disabled={!canMutate}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0 8px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    marginTop: 4,
                  }}
                />
              </label>
              <label style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                Heure
                <input
                  type="time"
                  value={time}
                  step={300}
                  disabled={!canMutate}
                  onChange={(e) => setTime(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0 8px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    marginTop: 4,
                  }}
                />
              </label>
              <label style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                Durée (min)
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  disabled={!canMutate}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    height: 34,
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0 8px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    marginTop: 4,
                  }}
                />
              </label>
            </div>
            <Button
              variant="primary"
              style={{ marginTop: 10 }}
              disabled={!canMutate || isMoving}
              onClick={() => void handleMove()}
            >
              {isMoving ? 'Déplacement…' : 'Déplacer le RDV'}
            </Button>

            {a.patientId && (
              <Button
                style={{ marginTop: 8, marginLeft: 8 }}
                onClick={() => navigate(`/patients/${a.patientId}`)}
              >
                Voir dossier patient
              </Button>
            )}

            {showCancel && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--danger)',
                    marginTop: 24,
                    marginBottom: 8,
                  }}
                >
                  Annuler ce RDV
                </div>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Raison de l&apos;annulation…"
                  style={{
                    width: '100%',
                    minHeight: 70,
                    border: '1px solid var(--danger)',
                    borderRadius: 6,
                    padding: 8,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Button onClick={() => setShowCancel(false)}>Retour</Button>
                  <Button
                    variant="primary"
                    style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                    disabled={isCancelling || cancelReason.trim().length < 3}
                    onClick={() => void handleCancel()}
                  >
                    {isCancelling ? 'Annulation…' : "Confirmer l'annulation"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-2)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {canCheckIn && (
              <Button
                variant="primary"
                disabled={isCheckingIn}
                onClick={() => void handleCheckIn()}
              >
                {isCheckingIn ? 'Check-in…' : 'Déclarer arrivée'}
              </Button>
            )}
            <Button
              disabled={!canMutate || showCancel}
              onClick={() => setShowCancel(true)}
              style={{ marginLeft: 'auto', color: 'var(--danger)' }}
            >
              Annuler le RDV
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
