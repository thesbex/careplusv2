/**
 * AppointmentDrawer — opens on click of an agenda block. Shows details,
 * lets the user move (date+time+duration) / cancel (with reason) / check-in.
 *
 * Wave 1 (2026-05-07) — auto-adaptive multi-doctor + room:
 *  - Practitioner dropdown shown only when ≥ 2 active practitioners.
 *  - Room dropdown shown only when ≥ 2 active rooms.
 *  - After a successful PUT that includes a roomId, the drawer fetches
 *    /appointments/{id}/room-conflicts. If non-empty → inline warning
 *    banner. Backend never blocks; the UI surfaces only.
 */
import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Close, Warn } from '@/components/icons';
import { useCheckIn } from '@/features/salle-attente/hooks/useCheckIn';
import {
  useMoveAppointment,
  useCancelAppointment,
  extractConflictMessage,
} from '../hooks/useAppointmentMutations';
import { usePractitioners } from '../hooks/usePractitioners';
import { useRooms } from '../hooks/useRooms';
import { useRoomConflicts, type RoomConflictView } from '../hooks/useRoomConflicts';
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

function formatPractitioner(p: {
  firstName: string;
  lastName: string;
  specialty: string | null;
}): string {
  const base = `Dr ${p.lastName} ${p.firstName}`.trim();
  return p.specialty ? `${base} — ${p.specialty}` : base;
}

/** Friendly label for backend appointment statuses — keeps the subtitle readable
 *  instead of leaking SCREAMING_SNAKE enums into the UI. */
const RAW_STATUS_LABELS: Record<string, string> = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  ARRIVE: 'Arrivé',
  EN_ATTENTE_CONSTANTES: 'En attente constantes',
  CONSTANTES_PRISES: 'Constantes prises',
  EN_CONSULTATION: 'En consultation',
  CONSULTATION_TERMINEE: 'Consultation terminée',
  TERMINE: 'Terminé',
  CLOS: 'Clos',
  ANNULE: 'Annulé',
};

function statusLabel(raw?: string): string | undefined {
  if (!raw) return undefined;
  return RAW_STATUS_LABELS[raw] ?? raw.replace(/_/g, ' ').toLowerCase();
}

function formatConflictTime(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const hh = String(s.getHours()).padStart(2, '0');
  const mm = String(s.getMinutes()).padStart(2, '0');
  const eh = String(e.getHours()).padStart(2, '0');
  const em = String(e.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}–${eh}:${em}`;
}

function formatConflictLabel(c: RoomConflictView): string {
  const drName = `Dr ${c.conflictPractitionerLastName}`.trim();
  return `${drName} ${formatConflictTime(c.conflictStartAt, c.conflictEndAt)}`;
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

  const { data: practitioners } = usePractitioners();
  const { data: rooms } = useRooms();
  // Practitioner dropdown only worth showing with ≥ 2 active practitioners.
  const showPractitionerField =
    practitioners.filter((p) => p.active).length >= 2;
  const showRoomField = rooms.filter((r) => r.active).length >= 2;
  const activePractitioners = useMemo(
    () => practitioners.filter((p) => p.active),
    [practitioners],
  );
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [practitionerId, setPractitionerId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>(''); // '' === no room
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  // After-save conflict-warning state. Driven by the room-conflicts query
  // re-enabled with a key when a new save is committed.
  const [conflictAppointmentId, setConflictAppointmentId] =
    useState<string | null>(null);
  const [conflictRoomId, setConflictRoomId] = useState<string | null>(null);
  const { data: conflicts } = useRoomConflicts({
    appointmentId: conflictAppointmentId,
    roomId: conflictRoomId,
  });

  useEffect(() => {
    if (appointment?.startAt) {
      const { date: d, time: t } = isoToLocalParts(appointment.startAt);
      setDate(d);
      setTime(t);
      setDuration(appointment.durationMinutes ?? appointment.dur);
    }
    // Pre-fill practitioner + room from the loaded appointment.
    setPractitionerId(appointment?.practitionerId ?? '');
    setRoomId(appointment?.roomId ?? '');
    if (!open) {
      setShowCancel(false);
      setCancelReason('');
      setConflictAppointmentId(null);
      setConflictRoomId(null);
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
        ...(practitionerId ? { practitionerId } : {}),
        // Send roomId (or null to clear) only if the field is meaningfully
        // visible — otherwise leave it untouched server-side.
        ...(showRoomField ? { roomId: roomId || null } : {}),
      });
      toast.success('RDV déplacé.');
      // Trigger conflict probe only when a room is now assigned.
      if (roomId) {
        setConflictAppointmentId(id);
        setConflictRoomId(roomId);
      } else {
        setConflictAppointmentId(null);
        setConflictRoomId(null);
      }
      onChanged?.();
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
      // Send roomId only when the multi-room field is visible AND the user
      // picked a non-empty value. The backend treats roomId=null as "preserve",
      // not "clear" — to actually clear a room, use "Déplacer le RDV". So we
      // simply omit the field when the dropdown shows "Aucune".
      const args =
        showRoomField && roomId
          ? { appointmentId: id, roomId }
          : { appointmentId: id };
      await checkIn(args);
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
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {a.patient}
              </Dialog.Title>
              <Dialog.Description
                style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0, marginTop: 2 }}
              >
                {a.reason} · {a.start} ({a.dur}min)
                {statusLabel(a.rawStatus) ? ` · ${statusLabel(a.rawStatus)}` : ''}
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

            {/* Conflict warning banner — surfaces room overlaps after a save. */}
            {conflicts && conflicts.length > 0 && (
              <div
                role="alert"
                aria-label="Conflit salle"
                style={{
                  padding: 12,
                  background: 'var(--amber-soft)',
                  border: '1px solid #E8CFA9',
                  color: 'var(--amber)',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 16,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                <Warn />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Conflit salle : {conflicts.length} autre
                    {conflicts.length > 1 ? 's ' : ' '}
                    RDV partagent cette salle au même créneau.
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {conflicts.map((c) => (
                      <li key={c.conflictAppointmentId}>{formatConflictLabel(c)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="ag-drawer-section">Déplacer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="field">
                <label htmlFor="ag-drawer-date">Date</label>
                <input
                  id="ag-drawer-date"
                  className="input tnum"
                  type="date"
                  value={date}
                  disabled={!canMutate}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ag-drawer-time">Heure</label>
                <input
                  id="ag-drawer-time"
                  className="input tnum"
                  type="time"
                  value={time}
                  step={300}
                  disabled={!canMutate}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ag-drawer-dur">Durée (min)</label>
                <input
                  id="ag-drawer-dur"
                  className="input tnum"
                  type="number"
                  min={5}
                  step={5}
                  value={duration}
                  disabled={!canMutate}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {showPractitionerField && (
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="ag-drawer-practitioner">Médecin</label>
                <Select
                  id="ag-drawer-practitioner"
                  className="select"
                  value={practitionerId}
                  disabled={!canMutate}
                  aria-label="Médecin"
                  onChange={(e) => setPractitionerId(e.target.value)}
                >
                  <option value="" disabled>
                    Choisir un médecin…
                  </option>
                  {activePractitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatPractitioner(p)}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {showRoomField && (
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="ag-drawer-room">Salle</label>
                <Select
                  id="ag-drawer-room"
                  className="select"
                  value={roomId}
                  disabled={!canMutate}
                  aria-label="Salle"
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  <option value="">Aucune</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.capabilityTags.length > 0 ? ` (${r.capabilityTags.join(', ')})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              <Button
                variant="primary"
                disabled={!canMutate || isMoving}
                onClick={() => void handleMove()}
              >
                {isMoving ? 'Déplacement…' : 'Déplacer le RDV'}
              </Button>

              {a.patientId && (
                <Button onClick={() => navigate(`/patients/${a.patientId}`)}>
                  Voir dossier patient
                </Button>
              )}
            </div>

            {showCancel && (
              <>
                <div className="ag-drawer-section ag-drawer-section--danger">
                  Annuler ce RDV
                </div>
                <textarea
                  className="textarea"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Raison de l&apos;annulation…"
                  style={{ borderColor: 'var(--danger)' }}
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
              padding: '12px 18px',
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
              variant="danger"
              disabled={!canMutate || showCancel}
              onClick={() => setShowCancel(true)}
              style={{ marginLeft: 'auto' }}
            >
              Annuler le RDV
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

