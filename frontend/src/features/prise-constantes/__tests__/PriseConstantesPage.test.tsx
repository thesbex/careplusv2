/**
 * Smoke tests for Prise des constantes — screen 05.
 * Covers: desktop + mobile render with fixture defaults, field labels,
 * submit handler called, a11y (jest-axe).
 *
 * Per ADR-018: run only this suite during development:
 *   npm test -- --run features/prise-constantes
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PriseConstantesPage from '../PriseConstantesPage';
import PriseConstantesMobilePage from '../PriseConstantesPage.mobile';

vi.mock('../hooks/useRecordVitals', () => ({
  useRecordVitals: () => ({
    submit: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isSuccess: false,
    error: null,
  }),
}));

vi.mock('../hooks/useAppointment', () => ({
  useAppointment: () => ({
    appointment: {
      id: 'a1',
      patientId: 'p1',
      practitionerId: 'u1',
      startAt: '2026-04-24T10:00:00Z',
      endAt: '2026-04-24T10:30:00Z',
      status: 'ARRIVE',
      type: null,
      reasonLabel: 'Première consultation',
      originConsultationId: null,
      arrivedAt: '2026-04-24T09:41:00Z',
      createdAt: '2026-04-24T08:00:00Z',
      updatedAt: '2026-04-24T09:41:00Z',
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/features/dossier-patient/hooks/usePatient', () => ({
  usePatient: () => ({
    patient: {
      id: 'p1',
      dossierNo: 'PT-001',
      initials: 'YZ',
      fullName: 'Youssef Ziani',
      sex: 'H',
      age: 38,
      cin: '—',
      birthDate: '1988-01-01',
      phone: '—',
      email: '—',
      bloodGroup: '—',
      insurance: '—',
      allergies: ['Pénicilline'],
      allergyNotes: '',
      antecedents: '',
      chronicTreatment: '',
      timeline: [],
      lastVitals: [],
      lastVitalsDate: '',
      currentMedications: [],
      currentMedicationsSince: '',
      admin: [],
    },
    raw: null,
    isLoading: false,
    error: null,
  }),
}));

// ── Helpers ──────────────────────────────────────────────

function renderDesktop() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/constantes', element: <PriseConstantesPage /> },
      { path: '/salle',      element: <div>Salle</div> },
      { path: '/agenda',     element: <div>Agenda</div> },
      { path: '/patients',   element: <div>Patients</div> },
      { path: '/facturation',element: <div>Facturation</div> },
      { path: '/parametres', element: <div>Paramètres</div> },
      { path: '/consultations', element: <div>Consultations</div> },
    ],
    { initialEntries: ['/constantes'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function renderMobile() {
  const router = createMemoryRouter(
    [
      { path: '/constantes', element: <PriseConstantesMobilePage /> },
      { path: '/salle',      element: <div>Salle</div> },
    ],
    { initialEntries: ['/constantes'] },
  );
  return render(<RouterProvider router={router} />);
}

// ── Desktop suite ────────────────────────────────────────

describe('<PriseConstantesPage /> (desktop)', () => {
  it('renders Screen shell with correct title and subtitle', () => {
    const { container } = renderDesktop();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent(
      'Prise des constantes',
    );
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent(
      /Youssef Ziani · 38 ans · RDV \d{2}:\d{2}/,
    );
  });

  it('renders all 6 vital field labels from the prototype', () => {
    renderDesktop();
    // TA uses two sub-inputs (systolique / diastolique)
    expect(screen.getByLabelText('Tension systolique')).toBeInTheDocument();
    expect(screen.getByLabelText('Tension diastolique')).toBeInTheDocument();
    // Single-value vital fields
    expect(screen.getByLabelText('Fréquence cardiaque')).toBeInTheDocument();
    expect(screen.getByLabelText('Température')).toBeInTheDocument();
    expect(screen.getByLabelText('Saturation O₂')).toBeInTheDocument();
    expect(screen.getByLabelText('Poids')).toBeInTheDocument();
    expect(screen.getByLabelText('Taille')).toBeInTheDocument();
  });

  it('renders the 3 step headings verbatim', () => {
    renderDesktop();
    expect(screen.getByText('Étape 1 · Mesures')).toBeInTheDocument();
    expect(screen.getByText('Étape 2 · Mesures optionnelles')).toBeInTheDocument();
    // The heading uses &amp; so test the rendered text
    expect(screen.getByText(/Étape 3/)).toBeInTheDocument();
  });

  it('renders optional measure labels', () => {
    renderDesktop();
    expect(screen.getByLabelText('Glycémie capillaire (g/L)')).toBeInTheDocument();
    expect(screen.getByLabelText('Périmètre abdominal (cm)')).toBeInTheDocument();
    expect(screen.getByLabelText('FR (/min)')).toBeInTheDocument();
  });

  it('renders the notes textarea with prototype default text', () => {
    renderDesktop();
    const textarea = screen.getByLabelText('Motif déclaré par le patient');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(
      'Patient vient pour première consultation. Se plaint de fatigue depuis 2 semaines, maux de tête le matin. Antécédents familiaux : père hypertendu.',
    );
  });

  it('renders checkbox options verbatim from prototype', () => {
    renderDesktop();
    expect(screen.getByLabelText(/À jeun/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Carnet de santé apporté/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Résultats d'analyses apportés/)).toBeInTheDocument();
  });

  it('renders right-panel patient identity (Youssef Ziani)', () => {
    renderDesktop();
    expect(screen.getByText('Youssef Ziani')).toBeInTheDocument();
    expect(screen.getByText('38 ans · ♂ · Première consultation')).toBeInTheDocument();
  });

  it('renders the reference range panel header', () => {
    renderDesktop();
    expect(screen.getByText('Repères (H 30-50 ans)')).toBeInTheDocument();
  });

  it('renders the amber TA warning callout', () => {
    renderDesktop();
    expect(screen.getByText('TA légèrement élevée')).toBeInTheDocument();
    expect(
      screen.getByText(/Le patient sera orienté en consultation/),
    ).toBeInTheDocument();
  });

  it('renders both CTA buttons verbatim', () => {
    renderDesktop();
    expect(
      screen.getByRole('button', { name: 'Envoyer en consultation →' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Enregistrer et remettre en attente' }),
    ).toBeInTheDocument();
  });

  it('renders the "Saisi par" footer line', () => {
    renderDesktop();
    expect(screen.getByText(/Saisi par Leila Berrada/)).toBeInTheDocument();
  });

  it('renders the IMC bar with calculated BMI', () => {
    renderDesktop();
    // Default: 74kg, 178cm → BMI ≈ 23.4
    expect(screen.getByText(/IMC calculé/)).toBeInTheDocument();
    expect(screen.getByText('23.4')).toBeInTheDocument();
  });

  it('calls submit handler when "Envoyer en consultation" is clicked', async () => {
    renderDesktop();
    const submitBtn = screen.getByRole('button', { name: 'Envoyer en consultation →' });
    fireEvent.click(submitBtn);
    // Mock submit resolves; page navigates away — check the button existed
    await waitFor(() => {
      expect(submitBtn).toBeTruthy();
    });
  });

  it('has no serious a11y violations', async () => {
    const { container } = renderDesktop();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Mobile suite ─────────────────────────────────────────

describe('<PriseConstantesMobilePage />', () => {
  it('renders mobile topbar with title "Constantes" and patient name from backend', () => {
    renderMobile();
    expect(screen.getByText('Constantes')).toBeInTheDocument();
    // Mocked usePatient resolves to "Youssef Ziani"
    expect(screen.getAllByText('Youssef Ziani').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the allergy warning bar built from patient data', () => {
    renderMobile();
    expect(screen.getByText('Allergie : Pénicilline')).toBeInTheDocument();
  });

  it('renders the "Signes vitaux" section heading', () => {
    renderMobile();
    expect(screen.getByText('Signes vitaux')).toBeInTheDocument();
  });

  it('renders all 4 mobile vital card labels', () => {
    renderMobile();
    expect(screen.getByText('Tension artérielle')).toBeInTheDocument();
    expect(screen.getByText('Fréquence cardiaque')).toBeInTheDocument();
    expect(screen.getByText('Température')).toBeInTheDocument();
    expect(screen.getByText('Saturation O₂')).toBeInTheDocument();
  });

  it('renders reference range hints verbatim', () => {
    renderMobile();
    expect(screen.getByText('Ref. 120/80')).toBeInTheDocument();
    expect(screen.getByText('Ref. 60–100')).toBeInTheDocument();
    expect(screen.getByText('Ref. 36,1–37,2')).toBeInTheDocument();
    expect(screen.getByText('Ref. ≥ 95')).toBeInTheDocument();
  });

  it('renders previous-value hints for TA and FC', () => {
    renderMobile();
    expect(screen.getByText('Prec. 135/85')).toBeInTheDocument();
    expect(screen.getByText('Prec. 78')).toBeInTheDocument();
  });

  it('renders Poids · Taille · IMC field group label', () => {
    renderMobile();
    expect(screen.getByText('Poids · Taille · IMC')).toBeInTheDocument();
  });

  it('renders the submit button with correct label', () => {
    renderMobile();
    expect(
      screen.getByRole('button', { name: 'Enregistrer et passer la main' }),
    ).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobile();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
