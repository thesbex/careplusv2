/**
 * PatientContextCard tests — verrouillent le fix B1 (2026-05-06).
 *
 * Bug B1 : le composant ne rendait que TA / FC / T° / SpO₂ / IMC. Un médecin
 * saisissait poids + taille + glycémie + FR + périmètres dans la prise des
 * constantes, voyait FC mais pas le reste, croyait à une perte de données.
 * Après le fix, TOUTES les constantes non-null sont affichées, et celles
 * jamais saisies (null) ne génèrent pas de ligne (pas de "—" parasite).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatientContextCard } from '../PatientContextCard';
import type { VitalsApi } from '../../hooks/useLatestVitals';
import type { PatientSummary } from '@/features/dossier-patient/types';

const PATIENT: PatientSummary = {
  id: 'pat-1',
  dossierNo: 'PT-00482',
  initials: 'SB',
  fullName: 'Sara Bennani',
  sex: 'F',
  age: 34,
  cin: 'BE 123456',
  birthDate: '1992-01-01',
  phone: '+212 6 00 00 00 00',
  email: 's@test.ma',
  bloodGroup: 'A+',
  insurance: '—',
  allergies: [],
  allergyDetails: [],
  antecedentDetails: [],
  allergyNotes: '',
  antecedents: '',
  chronicTreatment: '',
  timeline: [],
  lastVitals: [],
  lastVitalsDate: '',
  currentMedications: [],
  currentMedicationsSince: '',
  admin: [],
};

function makeVitals(over: Partial<VitalsApi> = {}): VitalsApi {
  return {
    id: 'v-1',
    patientId: 'pat-1',
    appointmentId: null,
    consultationId: 'cons-1',
    systolicMmhg: null,
    diastolicMmhg: null,
    temperatureC: null,
    weightKg: null,
    heightCm: null,
    bmi: null,
    heartRateBpm: null,
    respiratoryRateBpm: null,
    spo2Percent: null,
    glycemiaGPerL: null,
    abdominalPerimeterCm: null,
    headCircumferenceCm: null,
    recordedAt: '2026-05-06T10:00:00Z',
    recordedBy: null,
    notes: null,
    ...over,
  };
}

describe('<PatientContextCard /> — bug B1 régression guard', () => {
  it("scénario exact du bug : taille + FC saisis → les DEUX s'affichent", () => {
    render(
      <PatientContextCard
        patient={PATIENT}
        vitals={makeVitals({ heartRateBpm: 72, heightCm: 170 })}
      />,
    );
    // Avant le fix, FC apparaissait, taille était silencieusement filtrée.
    expect(screen.getByText('FC')).toBeInTheDocument();
    expect(screen.getByText('72 bpm')).toBeInTheDocument();
    expect(screen.getByText('Taille')).toBeInTheDocument();
    expect(screen.getByText('170 cm')).toBeInTheDocument();
  });

  it('affiche les 11 constantes quand toutes sont renseignées', () => {
    render(
      <PatientContextCard
        patient={PATIENT}
        vitals={makeVitals({
          systolicMmhg: 132,
          diastolicMmhg: 84,
          heartRateBpm: 72,
          respiratoryRateBpm: 16,
          temperatureC: 36.8,
          spo2Percent: 98,
          weightKg: 70.5,
          heightCm: 170,
          bmi: 24.4,
          glycemiaGPerL: 0.95,
          abdominalPerimeterCm: 92,
          headCircumferenceCm: 56,
        })}
      />,
    );
    expect(screen.getByText('132 / 84 mmHg')).toBeInTheDocument();
    expect(screen.getByText('72 bpm')).toBeInTheDocument();
    expect(screen.getByText('16 /min')).toBeInTheDocument();
    expect(screen.getByText('36,8 °C')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('70,5 kg')).toBeInTheDocument();
    expect(screen.getByText('170 cm')).toBeInTheDocument();
    expect(screen.getByText('24,4 kg/m²')).toBeInTheDocument();
    expect(screen.getByText('0,95 g/L')).toBeInTheDocument();
    expect(screen.getByText('92 cm')).toBeInTheDocument();
    expect(screen.getByText('56 cm')).toBeInTheDocument();
  });

  it('n\'affiche PAS de ligne pour une constante null (cas le plus courant)', () => {
    render(
      <PatientContextCard
        patient={PATIENT}
        vitals={makeVitals({ heartRateBpm: 72 })}
      />,
    );
    // Seule la FC est saisie : aucune autre clé ne doit apparaître.
    expect(screen.getByText('FC')).toBeInTheDocument();
    expect(screen.queryByText('TA')).not.toBeInTheDocument();
    expect(screen.queryByText('Taille')).not.toBeInTheDocument();
    expect(screen.queryByText('Poids')).not.toBeInTheDocument();
    expect(screen.queryByText('Glycémie')).not.toBeInTheDocument();
    expect(screen.queryByText('Périm. abdo.')).not.toBeInTheDocument();
    expect(screen.queryByText('Périm. crânien')).not.toBeInTheDocument();
  });

  it('tolère les BigDecimal sérialisés en string par Jackson', () => {
    render(
      <PatientContextCard
        patient={PATIENT}
        vitals={makeVitals({
          weightKg: '70.5' as unknown as number,
          heightCm: '170' as unknown as number,
          bmi: '24.4' as unknown as number,
          temperatureC: '36.8' as unknown as number,
          glycemiaGPerL: '0.95' as unknown as number,
        })}
      />,
    );
    expect(screen.getByText('70,5 kg')).toBeInTheDocument();
    expect(screen.getByText('170 cm')).toBeInTheDocument();
    expect(screen.getByText('24,4 kg/m²')).toBeInTheDocument();
    expect(screen.getByText('36,8 °C')).toBeInTheDocument();
    expect(screen.getByText('0,95 g/L')).toBeInTheDocument();
  });

  it('quand vitals=null, affiche le CTA « Saisir les constantes »', () => {
    render(<PatientContextCard patient={PATIENT} vitals={null} onRecordVitals={() => {}} />);
    expect(
      screen.getByText('Aucune constante prise pour cette consultation.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Saisir les constantes/i })).toBeInTheDocument();
  });
});
