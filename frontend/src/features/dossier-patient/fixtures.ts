/**
 * Mock data fixtures for the Dossier patient screen.
 * Lifted verbatim from design/prototype/screens/dossier-patient.jsx and
 * design/prototype/mobile/screens.jsx (MDossier block).
 * When the backend patient module ships (J3), usePatient replaces these
 * with real data from GET /api/patients/:id.
 */
import type { PatientSummary } from './types';

export const PATIENT_MOHAMED_ALAMI: PatientSummary = {
  id: 'PT-00482',
  dossierNo: 'PT-00482',
  initials: 'MA',
  fullName: 'Mohamed Alami',
  sex: 'Homme',
  age: 52,
  cin: 'BE 328451',
  birthDate: '14/07/1973',
  phone: '+212 6 61 12 34 56',
  email: 'malami@gmail.com',
  bloodGroup: 'O+',
  insurance: 'CNSS · 112 456 789',
  allergies: ['Pénicilline'],
  allergyNotes: 'Pénicilline (réaction cutanée, signalée 2019)',
  antecedents: 'HTA (2018), Dyslipidémie',
  chronicTreatment: 'Amlodipine 5mg, Atorvastatine 20mg',
  timeline: [
    {
      date: '23/04/2026',
      time: '09:12',
      kind: 'consult',
      title: 'Consultation de suivi',
      who: 'Dr. Karim El Amrani',
      summary:
        'TA 135/85 — Légère augmentation par rapport au dernier contrôle. Ajustement posologique Amlodipine discuté.',
      tags: ['Ordonnance', 'HTA'],
      live: true,
    },
    {
      date: '18/03/2026',
      time: '10:30',
      kind: 'consult',
      title: 'Consultation de suivi',
      who: 'Dr. Karim El Amrani',
      summary: 'Examen cardiovasculaire normal. Bilan lipidique demandé.',
      tags: ['Ordonnance', 'Bilan'],
    },
    {
      date: '25/03/2026',
      time: '—',
      kind: 'analyse',
      title: 'Bilan lipidique — Labo Atlas',
      summary: 'Cholestérol total 2.35 g/L, LDL 1.58 g/L, HDL 0.42 g/L, TG 1.72 g/L',
      tags: ['Résultat reçu'],
    },
    {
      date: '10/02/2026',
      time: '11:00',
      kind: 'consult',
      title: 'Consultation',
      who: 'Dr. Karim El Amrani',
      summary: 'Patient asymptomatique. Renouvellement traitement chronique.',
      tags: ['Ordonnance'],
    },
    {
      date: '14/01/2026',
      time: '—',
      kind: 'doc',
      title: 'Certificat médical — sport',
      tags: ['Document'],
    },
    {
      date: '12/11/2025',
      time: '09:45',
      kind: 'consult',
      title: 'Consultation',
      who: 'Dr. Karim El Amrani',
      summary: 'Contrôle tensionnel. TA 128/82. Adaptation régime alimentaire conseillée.',
      tags: ['Ordonnance'],
    },
  ],
  lastVitals: [
    { k: 'TA', v: '135 / 85 mmHg', warn: true },
    { k: 'FC', v: '72 bpm' },
    { k: 'T°', v: '36.8 °C' },
    { k: 'SpO₂', v: '98%' },
    { k: 'Poids', v: '82 kg' },
    { k: 'IMC', v: '27.4', warn: true },
  ],
  lastVitalsDate: '23/04/2026',
  currentMedications: [
    { name: 'Amlodipine 5 mg', posology: '1 cp le matin' },
    { name: 'Atorvastatine 20 mg', posology: '1 cp le soir' },
    { name: 'Aspirine 100 mg', posology: '1 cp le midi' },
  ],
  currentMedicationsSince: 'Depuis 02/2024',
  admin: [
    { k: 'RGPD signé', v: '12/03/2024' },
    { k: 'CNSS à jour', v: 'Oui · exp. 12/2026' },
    { k: 'Mutuelle', v: '—' },
  ],
};

/** Fixture list used for /patients index (future). */
export const PATIENTS: PatientSummary[] = [PATIENT_MOHAMED_ALAMI];
