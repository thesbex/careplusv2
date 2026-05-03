/**
 * Screen 02 — Prise de RDV (mobile).
 * Ported from design/prototype/mobile/screens.jsx:MPriseRDV verbatim.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronRight } from '@/components/icons';
import { useAvailability } from './hooks/useAvailability';
import { useReasons } from './hooks/useReasons';
import { useCreateAppointment } from './hooks/useCreateAppointment';
import { rdvFormSchema } from './schema';
import { DURATION_OPTIONS } from './fixtures';
import type { RdvFormValues } from './types';
import './prise-rdv.css';

export default function PriseRDVMobilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Patient may be passed via ?patientId=... from a prior selection step
  const patientIdParam = searchParams.get('patientId') ?? null;
  const patientNameParam = searchParams.get('patientName') ?? null;

  const today = new Date();

  function fmtDmy(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function fmtIso(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  const todayIso = fmtIso(today);
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  // Convert ISO yyyy-mm-dd back to dd/mm/yyyy for the API.
  const selectedDateDmy = (() => {
    const [y, m, d] = selectedDateIso.split('-');
    return `${d}/${m}/${y}`;
  })();

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(20);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const { slots } = useAvailability(selectedDateDmy, selectedDuration);
  const { reasons } = useReasons();
  const { createAppointment, isPending, error } = useCreateAppointment();

  const { register, handleSubmit } = useForm<RdvFormValues>({
    resolver: zodResolver(rdvFormSchema),
    defaultValues: {
      patientId: patientIdParam,
      patientQuery: '',
      date: fmtDmy(today),
      time: selectedSlot ?? '09:00',
      durationMin: selectedDuration,
      reasonId: null,
      notes: '',
      sendSms: true,
    },
  });

  async function onSubmit(data: RdvFormValues) {
    setPatientError(null);
    setSlotError(null);
    if (!patientIdParam) {
      setPatientError('Aucun patient sélectionné.');
      return;
    }
    if (!selectedSlot) {
      setSlotError('Sélectionnez un créneau disponible.');
      return;
    }
    void data;
    const result = await createAppointment({
      patientId: patientIdParam,
      date: selectedDateDmy,
      time: selectedSlot,
      durationMin: selectedDuration,
      reasonId: data.reasonId,
      ...(data.notes ? { notes: data.notes } : {}),
    }).catch(() => null);
    if (result) navigate('/agenda');
  }

  return (
    <MScreen
      tab="agenda"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title="Nouveau RDV"
          right={
            <span
              style={{ color: 'var(--ink-3)', fontSize: 13, padding: '0 12px', fontWeight: 550 }}
              role="button"
              tabIndex={0}
              onClick={() => navigate(-1)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(-1)}
            >
              Annuler
            </span>
          }
        />
      }
    >
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}>
        <div className="mb-pad-lg">
          {/* Patient card */}
          <div className="m-section-h">
            <h3>Patient</h3>
          </div>
          {patientError && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{patientError}</div>
          )}
          <div className="m-card" style={{ marginBottom: 18 }}>
            <div className="m-row">
              <Avatar
                initials={patientNameParam ? patientNameParam.split(' ').map((x) => x[0]).join('').slice(0, 2) : '?'}
                style={{ width: 38, height: 38, fontSize: 13 }}
              />
              <div className="m-row-pri">
                <div className="m-row-main">{patientNameParam ?? 'Aucun patient'}</div>
                <div className="m-row-sub">{patientIdParam ? 'Patient sélectionné' : 'Retournez en arrière pour sélectionner un patient'}</div>
              </div>
              <span
                style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 550, cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label="Changer de patient"
                onClick={() => navigate('/patients')}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/patients')}
              >
                Changer
              </span>
            </div>
          </div>

          {/* Motif de consultation */}
          <div className="m-field">
            <label htmlFor="m-rdv-reason">Motif de consultation</label>
            <select id="m-rdv-reason" className="m-input" {...register('reasonId')}>
              {reasons.length === 0 ? (
                <option value="">Chargement…</option>
              ) : (
                reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))
              )}
            </select>
          </div>

          {/* Durée */}
          <div className="m-field">
            <label id="rdv-dur-label">Durée</label>
            <div className="m-segmented" role="group" aria-labelledby="rdv-dur-label">
              {DURATION_OPTIONS.filter((d) => d.value <= 45).map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={selectedDuration === d.value ? 'on' : ''}
                  aria-pressed={selectedDuration === d.value}
                  onClick={() => setSelectedDuration(d.value)}
                >
                  {d.value} min
                </button>
              ))}
            </div>
          </div>

          {/* Date picker */}
          <div className="m-field">
            <label htmlFor="m-rdv-date">Date</label>
            <input
              id="m-rdv-date"
              className="m-input"
              type="date"
              min={todayIso}
              value={selectedDateIso}
              onChange={(e) => {
                setSelectedDateIso(e.target.value);
                setSelectedSlot(null);
              }}
            />
          </div>

          {/* Available slots */}
          <div className="m-section-h" style={{ marginTop: 6 }}>
            <h3>Créneaux disponibles · {selectedDateDmy}</h3>
          </div>
          {slots.length === 0 ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 18 }}>
              Aucun créneau disponible pour ce jour.
            </div>
          ) : (
            <div className="prise-rdv-m-slots" role="group" aria-label="Créneaux disponibles">
              {slots.map((s) => {
                const isOn = s.time === selectedSlot;
                return (
                  <button
                    key={s.time}
                    type="button"
                    aria-pressed={isOn}
                    className={`prise-rdv-m-slot${isOn ? ' selected' : ''}`}
                    onClick={() => {
                      setSelectedSlot(s.time);
                      setSlotError(null);
                    }}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          )}
          {slotError && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{slotError}</div>
          )}

          {/* Note */}
          <div className="m-field">
            <label htmlFor="m-rdv-notes">Note pour le médecin (optionnel)</label>
            <textarea
              id="m-rdv-notes"
              className="m-input m-textarea"
              placeholder="Ex. Résultats du bilan disponibles"
              {...register('notes')}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</div>
          )}

          <button type="submit" className="m-btn primary" style={{ marginTop: 8 }} disabled={isPending}>
            {isPending ? 'Enregistrement…' : 'Confirmer le rendez-vous'}
            <ChevronRight />
          </button>
        </div>
      </form>
    </MScreen>
  );
}
