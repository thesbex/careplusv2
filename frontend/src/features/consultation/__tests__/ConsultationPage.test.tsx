/**
 * Smoke tests for Consultation (SOAP) — screen 06.
 * The page is fully wired to the backend; tests mock the data hooks so we
 * verify behavior (render, editable textareas, sign dialog) without hitting
 * the network.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// Mocks must be declared before importing the pages.
const mockConsultation = {
  id: 'c1',
  patientId: 'p1',
  practitionerId: 'u1',
  appointmentId: 'a1',
  versionNumber: 1,
  status: 'BROUILLON' as const,
  motif: 'Céphalées matinales depuis 10 jours.',
  examination: 'TA 135/85, auscultation normale.',
  diagnosis: '',
  notes: '',
  startedAt: '2026-04-24T09:12:00Z',
  signedAt: null,
  createdAt: '2026-04-24T09:12:00Z',
  updatedAt: '2026-04-24T09:46:00Z',
};

const mockPatient = {
  id: 'p1',
  dossierNo: 'PT-00482',
  initials: 'MA',
  fullName: 'Mohamed Alami',
  sex: 'H',
  age: 52,
  cin: '—',
  birthDate: '1974-01-01',
  phone: '—',
  email: '—',
  bloodGroup: '—',
  insurance: '—',
  allergies: ['Pénicilline'],
  allergyNotes: '',
  antecedents: 'HTA',
  chronicTreatment: 'Amlodipine 5 mg',
  timeline: [],
  lastVitals: [],
  lastVitalsDate: '',
  currentMedications: [],
  currentMedicationsSince: '',
  admin: [],
};

vi.mock('../hooks/useConsultation', () => ({
  useConsultation: () => ({
    consultation: mockConsultation,
    isLoading: false,
    error: null,
    update: vi.fn().mockResolvedValue(mockConsultation),
    isSaving: false,
    saveError: null,
    lastSavedAt: new Date('2026-04-24T09:46:00Z'),
  }),
}));

vi.mock('../hooks/useLatestVitals', () => ({
  useLatestVitals: () => ({ vitals: null, isLoading: false }),
}));

vi.mock('../hooks/useSignConsultation', () => ({
  useSignConsultation: () => ({
    sign: vi.fn().mockResolvedValue(true),
    isSigning: false,
    signed: false,
    error: null,
  }),
}));

vi.mock('@/features/dossier-patient/hooks/usePatient', () => ({
  usePatient: () => ({ patient: mockPatient, raw: null, isLoading: false, error: null }),
}));

import ConsultationPage from '../ConsultationPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/consultations/:id', element: <ConsultationPage /> },
      { path: '/agenda', element: <div>Agenda</div> },
      { path: '/patients', element: <div>Patients</div> },
      { path: '/salle', element: <div>Salle</div> },
      { path: '/facturation', element: <div>Facturation</div> },
      { path: '/parametres', element: <div>Paramètres</div> },
    ],
    { initialEntries: ['/consultations/c1'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<ConsultationPage /> (wired)', () => {
  it('renders Screen shell with real patient name', () => {
    const { container } = renderPage();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent(
      'Consultation en cours',
    );
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('Mohamed Alami');
  });

  it('renders patient context: name, age, allergy', () => {
    renderPage();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText(/52 ans/)).toBeInTheDocument();
    expect(screen.getByText(/Allergie : Pénicilline/)).toBeInTheDocument();
  });

  it('renders 4 editable SOAP textareas hydrated from consultation data', () => {
    renderPage();
    const subjectif = screen.getByLabelText('Subjectif — anamnèse') as HTMLTextAreaElement;
    const objectif = screen.getByLabelText('Objectif — examen') as HTMLTextAreaElement;
    const analyse = screen.getByLabelText('Appréciation — diagnostic') as HTMLTextAreaElement;
    const plan = screen.getByLabelText('Plan — conduite à tenir') as HTMLTextAreaElement;
    expect(subjectif).toBeInTheDocument();
    expect(objectif).toBeInTheDocument();
    expect(analyse).toBeInTheDocument();
    expect(plan).toBeInTheDocument();
    expect(subjectif.disabled).toBe(false);
    expect(subjectif.value).toContain('Céphalées matinales');
    expect(objectif.value).toContain('TA 135/85');
  });

  it('renders "En consultation" pill and sign button', () => {
    renderPage();
    expect(screen.getByText(/En consultation/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clôturer et facturer/ })).toBeInTheDocument();
  });

  it('opens confirmation dialog on Clôturer click', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Clôturer et facturer/ }));
    expect(
      screen.getByRole('dialog', { name: /Signer et verrouiller la consultation/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer et clôturer/ })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderPage();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
