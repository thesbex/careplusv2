/**
 * Mock fixtures for the Consultation (SOAP) screen.
 * Lifted verbatim from design/prototype/screens/consultation.jsx and
 * design/prototype/mobile/screens.jsx (MConsultation block).
 * When the backend consultation module ships (J5), useConsultation replaces
 * these with real data from GET /api/consultations/:id.
 */
import type {
  ConsultationPatient,
  ConsultationSession,
} from './types';

export const CONSULTATION_PATIENT: ConsultationPatient = {
  initials: 'MA',
  fullName: 'Mohamed Alami',
  age: 52,
  sex: '♂',
  dossierNo: 'PT-00482',
  allergy: 'Pénicilline',
  conditions: 'HTA · dyslipidémie',
  vitalsTime: '09:04',
  vitals: [
    { k: 'TA', v: '135 / 85', warn: true },
    { k: 'FC', v: '72' },
    { k: 'T°', v: '36,8' },
    { k: 'SpO₂', v: '98%' },
    { k: 'IMC', v: '27,4', warn: true },
  ],
  currentMedications: [
    { name: 'Amlodipine 5 mg', posology: '1 cp matin', since: 'depuis 02/2024' },
    { name: 'Atorvastatine 20 mg', posology: '1 cp soir', since: 'depuis 02/2024' },
    { name: 'Aspirine 100 mg', posology: '1 cp midi', since: 'depuis 02/2024' },
  ],
  followUps: [
    { date: '18/03', note: 'TA 128/82, bilan lipidique demandé.' },
    { date: '25/03', note: 'LDL 1.58 g/L (élevé), TG 1.72 g/L.' },
  ],
};

export const CONSULTATION_SESSION: ConsultationSession = {
  patientName: 'Mohamed Alami',
  startedAt: '09:12',
  box: 'Box 1',
  timer: '0:35:14',
  status: 'Brouillon',
  autoSavedAt: '09:46:58',
  soap: {
    subjectif:
      "Patient hypertendu connu depuis 2018. Se plaint de céphalées matinales depuis 10 jours, sans nausées ni vertiges. Pas de douleur thoracique, pas de dyspnée d'effort. Observance thérapeutique bonne. Stress professionnel récent. Pas de modification du régime alimentaire. Consomme 2 cafés/j, pas d'alcool, ancien fumeur (arrêté 2019).",
    objectif:
      "Examen cardio-vasculaire : B1-B2 bien frappés, pas de souffle. Pouls périphériques perçus et symétriques. Auscultation pulmonaire claire. Abdomen souple. Pas d'œdèmes des membres inférieurs. Fond d'œil : stade I. Poids +2 kg depuis dernière visite.",
    analyse: '',
    plan: '',
  },
  diagnoses: [
    { code: 'I10', label: 'Hypertension essentielle — contrôle imparfait' },
    { code: 'E78.5', label: 'Dyslipidémie non précisée' },
  ],
  plan: [
    { ico: 'Pill', text: 'Prescription — ajustement Amlodipine 5 → 10 mg', active: true },
    { ico: 'Flask', text: 'Analyses — bilan lipidique de contrôle dans 8 semaines' },
    { ico: 'Scan', text: 'Imagerie — ECG de repos' },
    { ico: 'Calendar', text: 'Prochain RDV suivi dans 4 semaines' },
  ],
};

/** Mobile SOAP accordion data (verbatim from MConsultation in mobile/screens.jsx) */
export const MOBILE_SOAP_SECTIONS = [
  {
    l: 'S',
    t: 'Subjectif',
    v: 'Patient rapporte des céphalées matinales depuis 3 semaines. Stress professionnel, sommeil perturbé. Pas de dyspnée ni douleur thoracique.',
  },
  {
    l: 'O',
    t: 'Objectif',
    v: 'TA 135/85 à 2 reprises. Auscultation cardiaque normale, rythme régulier. Poids stable (78 kg).',
  },
  {
    l: 'A',
    t: 'Analyse',
    v: 'Tension mal contrôlée sous Amlodipine 5 mg. Dyslipidémie suivie, résultats en attente.',
  },
  {
    l: 'P',
    t: 'Plan',
    v: 'Ajustement Amlodipine 5 → 10 mg. Bilan lipidique de contrôle à 8 semaines. ECG de repos.',
  },
] as const;

/** Mobile vitals grid (verbatim from MConsultation) */
export const MOBILE_VITALS = [
  ['TA', '135/85'],
  ['FC', '82'],
  ['T°', '36,8'],
  ['SpO₂', '98'],
] as const;
