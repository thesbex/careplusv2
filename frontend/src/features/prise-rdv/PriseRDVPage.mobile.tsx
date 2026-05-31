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
import { useT } from '@/lib/i18n/I18nProvider';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronRight } from '@/components/icons';
import { useAvailability } from './hooks/useAvailability';
import { useReasons } from './hooks/useReasons';
import { useCreateAppointment } from './hooks/useCreateAppointment';
import { usePractitioners } from '@/features/agenda/hooks/usePractitioners';
import { useAuthStore } from '@/lib/auth/authStore';
import { Select } from '@/components/ui/Input';
import { rdvFormSchema } from './schema';
import { DURATION_OPTIONS } from './fixtures';
import type { RdvFormValues } from './types';
import './prise-rdv.css';

export default function PriseRDVMobilePage() {
  const { t } = useT();
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

  // Resolve the practitioner whose slots we should display: the connected
  // medecin when applicable, otherwise the first active one. Without this,
  // a secrétaire would see her own (empty) availability.
  const currentUser = useAuthStore((s) => s.user);
  const isMedecin = currentUser?.roles?.includes('MEDECIN') ?? false;
  const { data: practitioners } = usePractitioners();
  const activePractitioners = practitioners.filter((p) => p.active);
  const effectivePractitionerId =
    isMedecin && currentUser?.id
      ? currentUser.id
      : activePractitioners[0]?.id ?? null;

  const { slots } = useAvailability(selectedDateDmy, selectedDuration, effectivePractitionerId);
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
      setPatientError(t('rdv.m.err.noPatient'));
      return;
    }
    if (!selectedSlot) {
      setSlotError(t('rdv.m.err.pickSlot'));
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
          left={<MIconBtn icon="ChevronLeft" label={t('rdv.m.back')} onClick={() => navigate(-1)} />}
          title={t('rdv.m.title')}
          right={
            <span
              style={{ color: 'var(--ink-3)', fontSize: 13, padding: '0 12px', fontWeight: 550 }}
              role="button"
              tabIndex={0}
              onClick={() => navigate(-1)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(-1)}
            >
              {t('common.cancel')}
            </span>
          }
        />
      }
    >
      <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}>
        <div className="mb-pad-lg">
          {/* Patient card */}
          <div className="m-section-h">
            <h3>{t('rdv.m.patient')}</h3>
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
                <div className="m-row-main">{patientNameParam ?? t('rdv.m.noPatient')}</div>
                <div className="m-row-sub">{patientIdParam ? t('rdv.m.patientSelected') : t('rdv.m.goBackToSelect')}</div>
              </div>
              <span
                style={{ color: 'var(--primary)', fontSize: 13, fontWeight: 550, cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={t('rdv.m.changePatientAria')}
                // ?picker=rdv signale à /patients qu'on est dans un flow de
                // sélection (et pas en navigation libre vers le dossier).
                // Sans ça, le click sur un patient menait vers le dossier et
                // l'utilisateur perdait son brouillon RDV.
                onClick={() => navigate('/patients?picker=rdv')}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/patients?picker=rdv')}
              >
                {patientIdParam ? t('rdv.change') : t('rdv.m.choose')}
              </span>
            </div>
          </div>

          {/* Motif de consultation */}
          <div className="m-field">
            <label htmlFor="m-rdv-reason">{t('rdv.m.reason')}</label>
            <Select id="m-rdv-reason" className="m-input" {...register('reasonId')}>
              {reasons.length === 0 ? (
                <option value="">{t('rdv.m.reasonLoading')}</option>
              ) : (
                reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))
              )}
            </Select>
          </div>

          {/* Durée */}
          <div className="m-field">
            <label id="rdv-dur-label">{t('rdv.m.duration')}</label>
            <div className="m-segmented" role="group" aria-labelledby="rdv-dur-label">
              {DURATION_OPTIONS.filter((d) => d.value <= 45).map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={selectedDuration === d.value ? 'on' : ''}
                  aria-pressed={selectedDuration === d.value}
                  onClick={() => setSelectedDuration(d.value)}
                >
                  {t('rdv.m.durationMin', { n: d.value })}
                </button>
              ))}
            </div>
          </div>

          {/* Date picker */}
          <div className="m-field">
            <label htmlFor="m-rdv-date">{t('rdv.m.date')}</label>
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
            <h3>{t('rdv.m.slotsForDay', { date: selectedDateDmy })}</h3>
          </div>
          {slots.length === 0 ? (
            <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 18 }}>
              {t('rdv.m.slotsEmpty')}
            </div>
          ) : (
            <div className="prise-rdv-m-slots" role="group" aria-label={t('rdv.slotsAria')}>
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
            <label htmlFor="m-rdv-notes">{t('rdv.m.noteLabel')}</label>
            <textarea
              id="m-rdv-notes"
              className="m-input m-textarea"
              placeholder={t('rdv.m.notePlaceholder')}
              {...register('notes')}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{t(error)}</div>
          )}

          <button type="submit" className="m-btn primary" style={{ marginTop: 8 }} disabled={isPending}>
            {isPending ? t('rdv.submitting') : t('rdv.m.confirm')}
            <ChevronRight />
          </button>
        </div>
      </form>
    </MScreen>
  );
}
