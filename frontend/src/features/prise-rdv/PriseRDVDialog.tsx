/**
 * Screen 02 — Prise de RDV (desktop).
 * Ported from design/prototype/screens/prise-rdv.jsx verbatim.
 *
 * Radix Dialog wraps the form — provides keyboard navigation, focus trap,
 * Escape to close, and WAI-ARIA roles (ADR-015: Radix for a11y affordances).
 */
import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel, FieldHelp } from '@/components/ui/Field';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Close, Search, Plus, Clock } from '@/components/icons';
import { usePatientSearch } from './hooks/usePatientSearch';
import { useReasons } from './hooks/useReasons';
import { useAvailability } from './hooks/useAvailability';
import { useCreateAppointment } from './hooks/useCreateAppointment';
import { rdvFormSchema } from './schema';
import { DURATION_OPTIONS } from './fixtures';
import type { RdvFormValues } from './types';
import './prise-rdv.css';

export interface PriseRDVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriseRDVDialog({ open, onOpenChange }: PriseRDVDialogProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();

  const { register, handleSubmit, watch, control } = useForm<RdvFormValues>({
    resolver: zodResolver(rdvFormSchema),
    defaultValues: {
      patientId: null,
      patientQuery: '',
      date: `${dd}/${mm}/${yyyy}`,
      time: '09:00',
      durationMin: 20,
      reasonId: null,
      notes: '',
      sendSms: true,
    },
  });

  const patientQuery = watch('patientQuery');
  const { candidates } = usePatientSearch(patientQuery);
  const { reasons } = useReasons();
  const { hintText } = useAvailability(watch('date'));

  useEffect(() => {
    if (reasons.length > 0 && selectedReasonId === null) {
      setSelectedReasonId(reasons[0]?.id ?? null);
    }
  }, [reasons, selectedReasonId]);
  const { createAppointment, isPending, error } = useCreateAppointment();

  async function onSubmit(data: RdvFormValues) {
    if (!selectedPatientId) return;
    await createAppointment({
      patientId: selectedPatientId,
      date: data.date,
      time: data.time,
      durationMin: data.durationMin,
      reasonId: selectedReasonId,
      ...(data.notes ? { notes: data.notes } : {}),
    }).catch(() => null);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="prise-rdv-overlay" />
        <Dialog.Content className="prise-rdv-dialog">
          {/* Header */}
          <div className="prise-rdv-header">
            <div>
              <Dialog.Title className="prise-rdv-header-title">
                Nouveau rendez-vous
              </Dialog.Title>
              <Dialog.Description className="prise-rdv-header-sub">
                Renseigner le patient et le créneau — le RDV sera ajouté à l&apos;agenda
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" iconOnly aria-label="Fermer" style={{ marginLeft: 'auto' }}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}>
            <div className="prise-rdv-body scroll">

              {/* Step 1: Patient */}
              <div style={{ marginBottom: 18 }}>
                <div className="prise-rdv-step-label">Étape 1 · Patient</div>
                <div className="prise-rdv-search">
                  <Search />
                  <input
                    {...register('patientQuery')}
                    className="prise-rdv-search-input"
                    placeholder="Nom, téléphone ou CIN…"
                    aria-label="Rechercher un patient"
                  />
                  <Button size="sm" type="button">
                    <Plus /> Nouveau
                  </Button>
                </div>

                {candidates.length > 0 && (
                  <div className="prise-rdv-candidates" role="listbox" aria-label="Résultats patients">
                    {candidates.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={selectedPatientId === s.id}
                        className={`prise-rdv-candidate-row${selectedPatientId === s.id ? ' selected' : ''}`}
                        onClick={() => setSelectedPatientId(s.id)}
                      >
                        <Avatar initials={s.name.split(' ').map((x) => x[0]).slice(0, 2).join('')} size="sm" />
                        <div style={{ flex: 1 }}>
                          <div className="prise-rdv-candidate-name">{s.name}</div>
                          <div className="prise-rdv-candidate-meta">
                            {s.phone} · Dernière visite : {s.lastVisit}
                          </div>
                        </div>
                        {s.tags.map((t) => (
                          <span key={t} className="pill">{t}</span>
                        ))}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Créneau */}
              <div style={{ marginBottom: 18 }}>
                <div className="prise-rdv-step-label">Étape 2 · Créneau</div>
                <div className="prise-rdv-creneau-grid">
                  <Field>
                    <FieldLabel htmlFor="rdv-date">Date</FieldLabel>
                    <Input id="rdv-date" className="tnum" {...register('date')} />
                    <FieldHelp>Format JJ/MM/AAAA</FieldHelp>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rdv-time">Heure</FieldLabel>
                    <Input id="rdv-time" className="tnum" {...register('time')} />
                    <FieldHelp>Créneau disponible</FieldHelp>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="rdv-dur">Durée</FieldLabel>
                    <Controller
                      name="durationMin"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="rdv-dur"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        >
                          {DURATION_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </Select>
                      )}
                    />
                  </Field>
                </div>

                <div className="prise-rdv-slot-hint" aria-live="polite">
                  <Clock />
                  <span>
                    Créneaux libres vendredi :{' '}
                    <strong style={{ color: 'var(--ink)' }}>
                      {hintText.split(' · ')[0]}
                    </strong>
                    {' · '}
                    {hintText.split(' · ').slice(1).join(' · ')}
                  </span>
                </div>
              </div>

              {/* Step 3: Motif */}
              <div>
                <div className="prise-rdv-step-label">Étape 3 · Motif</div>
                <Field style={{ marginBottom: 10 }}>
                  <FieldLabel>Type</FieldLabel>
                  <div className="prise-rdv-reason-btns" role="group" aria-label="Type de consultation">
                    {reasons.map((r) => {
                      const isSelected = selectedReasonId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="btn sm"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedReasonId(r.id)}
                          style={{
                            background: isSelected ? 'var(--primary-soft)' : 'var(--surface)',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                            color: isSelected ? 'var(--primary)' : 'var(--ink)',
                            fontWeight: isSelected ? 600 : 500,
                          }}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rdv-notes">Note pour le médecin (facultatif)</FieldLabel>
                  <Textarea
                    id="rdv-notes"
                    {...register('notes')}
                    placeholder="Ex. Apporter carnet de vaccination, résultats de la dernière prise de sang, etc."
                  />
                </Field>
              </div>
            </div>

            {/* Footer */}
            <div className="prise-rdv-footer">
              <label className="prise-rdv-sms-label">
                <input type="checkbox" {...register('sendSms')} defaultChecked />
                Envoyer un SMS de confirmation
              </label>
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</div>
              )}
              <div className="prise-rdv-footer-actions">
                <Dialog.Close asChild>
                  <Button type="button">Annuler</Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? 'Enregistrement…' : 'Confirmer le RDV'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
