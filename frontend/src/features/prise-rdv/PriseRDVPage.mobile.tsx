/**
 * Screen 02 — Prise de RDV (mobile).
 * Ported from design/prototype/mobile/screens.jsx:MPriseRDV verbatim.
 *
 * Full-screen form page using <MScreen noTabs> — the prototype shows a full
 * page, not a bottom sheet (MPriseRDV uses <MScreen noTabs>, not <MSheet>).
 *
 * Submit handler logs + navigates back for now.
 * TODO(backend:J4): wire to POST /api/appointments.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronRight } from '@/components/icons';
import { useAvailability } from './hooks/useAvailability';
import { rdvFormSchema } from './schema';
import { DURATION_OPTIONS } from './fixtures';
import type { RdvFormValues } from './types';
import './prise-rdv.css';

export default function PriseRDVMobilePage() {
  const navigate = useNavigate();
  const [selectedSlot, setSelectedSlot] = useState<string>('10:30');
  const [selectedDuration, setSelectedDuration] = useState<number>(20);

  const { slots } = useAvailability();

  const { register, handleSubmit } = useForm<RdvFormValues>({
    resolver: zodResolver(rdvFormSchema),
    defaultValues: {
      patientId: 'p-fl',
      patientQuery: '',
      date: '24/04/2026',
      time: '10:30',
      durationMin: 20,
      reasonId: 'suivi-grossesse',
      notes: '',
      sendSms: true,
    },
  });

  function onSubmit(data: RdvFormValues) {
    // TODO(backend:J4): POST /api/appointments
    console.log('[PriseRDVMobilePage] submit', { ...data, time: selectedSlot, durationMin: selectedDuration });
    navigate(-1);
  }

  return (
    <MScreen
      tab="agenda"
      noTabs
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title="Nouveau RDV"
          sub="Étape 2/3"
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
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-pad-lg">
          {/* Patient card (already selected) */}
          <div className="m-section-h">
            <h3>Patient</h3>
          </div>
          <div className="m-card" style={{ marginBottom: 18 }}>
            <div className="m-row">
              <Avatar initials="FL" style={{ width: 38, height: 38, fontSize: 13 }} />
              <div className="m-row-pri">
                <div className="m-row-main">Fatima Z. Lahlou</div>
                <div className="m-row-sub">Née le 14/03/1991 · CIN BK 472 193</div>
              </div>
              <span
                style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 550, cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label="Changer de patient"
              >
                Changer
              </span>
            </div>
          </div>

          {/* Motif de consultation */}
          <div className="m-field">
            <label htmlFor="m-rdv-reason">Motif de consultation</label>
            <select id="m-rdv-reason" className="m-input" {...register('reasonId')}>
              <option value="suivi-grossesse">Suivi grossesse 24 SA</option>
              <option value="premiere">Première consultation</option>
              <option value="suivi">Consultation de suivi</option>
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

          {/* Available slots */}
          <div className="m-section-h" style={{ marginTop: 6 }}>
            <h3>Créneaux disponibles · Jeudi 24 avril</h3>
          </div>
          <div className="prise-rdv-m-slots" role="group" aria-label="Créneaux disponibles">
            {slots.map((s) => {
              const isOn = s.time === selectedSlot;
              return (
                <button
                  key={s.time}
                  type="button"
                  aria-pressed={isOn}
                  className={`prise-rdv-m-slot${isOn ? ' selected' : ''}`}
                  onClick={() => setSelectedSlot(s.time)}
                >
                  {s.time}
                </button>
              );
            })}
          </div>

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

          <button type="submit" className="m-btn primary" style={{ marginTop: 8 }}>
            Confirmer le rendez-vous
            <ChevronRight />
          </button>
        </div>
      </form>
    </MScreen>
  );
}
