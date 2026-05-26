/**
 * AddWalkInDialog (QA9-12) — ajoute un patient sans RDV directement dans la
 * salle d'attente.
 *
 *   1. Recherche / sélection d'un patient existant (réutilise usePatientSearch
 *      du module prise-rdv — même contrat GET /patients?q=).
 *   2. Choix du médecin (dropdown des praticiens actifs ; présélection si 1 seul
 *      ou si l'utilisateur connecté est un MEDECIN cloisonné).
 *   3. Motif optionnel.
 *   4. « Ajouter à la salle » → useAddWalkIn (POST /appointments walkIn+urgency
 *      puis check-in) → toast + invalidation de la file.
 *
 * Radix Dialog pour le focus-trap / a11y (ADR-015), aligné sur
 * CancelAppointmentDialog et PriseRDVDialog.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Select } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Close, Search } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { usePatientSearch } from '@/features/prise-rdv/hooks/usePatientSearch';
import { useReasons } from '@/features/prise-rdv/hooks/useReasons';
import { usePractitioners } from '@/features/agenda/hooks/usePractitioners';
import { useAddWalkIn } from '../hooks/useAddWalkIn';

interface AddWalkInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}

export function AddWalkInDialog({ open, onOpenChange, onAdded }: AddWalkInDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [practitionerId, setPractitionerId] = useState<string>('');
  const [reasonId, setReasonId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const { candidates } = usePatientSearch(query);
  const { reasons } = useReasons();
  const { data: practitioners } = usePractitioners();
  const { addWalkIn, isPending } = useAddWalkIn();

  const currentUser = useAuthStore((s) => s.user);
  const isMedecin = currentUser?.roles?.includes('MEDECIN') ?? false;
  const activePractitioners = practitioners.filter((p) => p.active);

  // Default practitioner: the connected MEDECIN (cloisonné → only self anyway),
  // else the sole active practitioner, else empty (user must pick).
  useEffect(() => {
    if (!open) return;
    if (practitionerId) return;
    const selfActive =
      isMedecin && currentUser?.id
        ? activePractitioners.find((p) => p.id === currentUser.id)
        : undefined;
    if (selfActive) {
      setPractitionerId(selfActive.id);
    } else if (activePractitioners.length === 1 && activePractitioners[0]) {
      setPractitionerId(activePractitioners[0].id);
    }
  }, [open, practitionerId, isMedecin, currentUser?.id, activePractitioners]);

  // Reset transient state each time the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedPatientId(null);
      setSelectedPatientName(null);
      setReasonId('');
      setFormError(null);
      setPractitionerId('');
    }
  }, [open]);

  async function submit() {
    setFormError(null);
    if (!selectedPatientId) {
      setFormError('Veuillez sélectionner un patient.');
      return;
    }
    if (!practitionerId) {
      setFormError('Veuillez choisir un médecin.');
      return;
    }
    try {
      await addWalkIn({
        patientId: selectedPatientId,
        practitionerId,
        ...(reasonId ? { reasonId } : {}),
      });
      toast.success(`${selectedPatientName ?? 'Patient'} ajouté à la salle d'attente.`);
      onAdded?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
          ?.detail ??
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Impossible d'ajouter le patient à la salle.";
      setFormError(msg);
      toast.error(msg);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
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
            width: 'min(460px, 94vw)',
            maxHeight: '90vh',
            overflow: 'auto',
            zIndex: 101,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>
              Ajouter un patient sans RDV
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14 }}>
            Le patient est ajouté directement à la file d&apos;attente (arrivée immédiate).
          </Dialog.Description>

          {/* Patient picker */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel htmlFor="walkin-search">Patient</FieldLabel>
            {selectedPatientId && selectedPatientName ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  marginTop: 4,
                }}
              >
                <Avatar
                  initials={selectedPatientName
                    .split(' ')
                    .map((x) => x[0] ?? '')
                    .slice(0, 2)
                    .join('')}
                  size="sm"
                />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                  {selectedPatientName}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedPatientId(null);
                    setSelectedPatientName(null);
                    setQuery('');
                  }}
                >
                  Changer
                </Button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0 10px',
                    marginTop: 4,
                  }}
                >
                  <Search />
                  <input
                    id="walkin-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nom, téléphone ou CIN…"
                    aria-label="Rechercher un patient"
                    autoFocus
                    style={{
                      flex: 1,
                      height: 36,
                      border: 0,
                      background: 'transparent',
                      fontSize: 13,
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                </div>
                {candidates.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Résultats patients"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      marginTop: 6,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={selectedPatientId === c.id}
                        onClick={() => {
                          setSelectedPatientId(c.id);
                          setSelectedPatientName(c.name);
                          setFormError(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 0,
                          borderTop: '1px solid var(--border-soft)',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          font: 'inherit',
                        }}
                      >
                        <Avatar
                          initials={c.name
                            .split(' ')
                            .map((x) => x[0] ?? '')
                            .slice(0, 2)
                            .join('')}
                          size="sm"
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.phone}</div>
                        </div>
                        {c.tags.map((t) => (
                          <span key={t} className="pill">
                            {t}
                          </span>
                        ))}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Practitioner picker — only meaningful with ≥2 active doctors, but
              always rendered so a secrétaire can pick whose queue to feed. */}
          {activePractitioners.length >= 2 && (
            <Field style={{ marginBottom: 16 }}>
              <FieldLabel htmlFor="walkin-practitioner">Médecin</FieldLabel>
              <Select
                id="walkin-practitioner"
                aria-label="Médecin"
                value={practitionerId}
                onChange={(e) => {
                  setPractitionerId(e.target.value);
                  setFormError(null);
                }}
              >
                <option value="" disabled>
                  Choisir un médecin…
                </option>
                {activePractitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    Dr {p.lastName} {p.firstName}
                    {p.specialty ? ` — ${p.specialty}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {/* Reason (optional) */}
          {reasons.length > 0 && (
            <Field style={{ marginBottom: 16 }}>
              <FieldLabel htmlFor="walkin-reason">Motif (facultatif)</FieldLabel>
              <Select
                id="walkin-reason"
                aria-label="Motif"
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
              >
                <option value="">Aucun</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {formError && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <Dialog.Close asChild>
              <Button type="button">Annuler</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="primary"
              disabled={isPending || !selectedPatientId}
              onClick={() => void submit()}
            >
              {isPending ? 'Ajout…' : 'Ajouter à la salle'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
