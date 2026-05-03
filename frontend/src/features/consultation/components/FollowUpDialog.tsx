/**
 * Modale "Prochain RDV" — créé un RDV de contrôle (CONTROLE) lié à la
 * consultation courante via POST /api/consultations/{id}/follow-up.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close } from '@/components/icons';
import { api } from '@/lib/api/client';

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

export function FollowUpDialog({ open, onOpenChange, consultationId, onCreated }: FollowUpDialogProps) {
  // Default = 7 jours plus tard à 09:00 (cas typique du contrôle généraliste).
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('09:00');
  const [reasonId, setReasonId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (open) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDate(d.toISOString().slice(0, 10));
      setTime('09:00');
      setNotes('');
    }
  }, [open]);

  const { data: reasons = [] } = useQuery<ReasonView[]>({
    queryKey: ['scheduling-reasons'],
    queryFn: () => api.get<ReasonView[]>('/reasons').then((r) => r.data),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // Pré-sélectionne le motif "Contrôle" si présent dans le seed.
  useEffect(() => {
    if (reasons.length > 0 && !reasonId) {
      const ctrl = reasons.find((r) => /control|contrôle|suivi/i.test(r.label) || /CONTROL/i.test(r.code));
      const fallback = reasons[0];
      setReasonId(ctrl?.id ?? fallback?.id ?? '');
    }
  }, [reasons, reasonId]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/consultations/${consultationId}/follow-up`, {
        date,
        time: time.length === 5 ? time + ':00' : time,
        reasonId: reasonId || null,
        notes: notes || null,
      }),
  });

  async function submit() {
    if (!date || !time) {
      toast.error('Date et heure requises.');
      return;
    }
    try {
      await mutation.mutateAsync();
      toast.success('Prochain RDV créé.');
      onCreated?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Création du RDV refusée.';
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
            width: 'min(440px, 92vw)',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              Programmer un prochain RDV
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
            RDV de contrôle lié à cette consultation. Apparait dans l'agenda.
          </Dialog.Description>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Date</label>
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
                <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Heure</label>
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

            <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Motif</label>
            <select
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
              <option value="">— choisir —</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.durationMinutes} min)
                </option>
              ))}
            </select>

            <label style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. contrôle bilan biologique, retour résultats…"
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
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <Dialog.Close asChild>
              <Button>Annuler</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Création…' : 'Programmer'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
