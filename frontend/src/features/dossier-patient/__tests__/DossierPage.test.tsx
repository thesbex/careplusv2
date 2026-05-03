import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import DossierPage from '../DossierPage';
import { PATIENT_MOHAMED_ALAMI } from '../fixtures';

vi.mock('../hooks/usePatient', () => ({
  usePatient: () => ({
    patient: PATIENT_MOHAMED_ALAMI,
    raw: {
      id: PATIENT_MOHAMED_ALAMI.id,
      firstName: 'Mohamed',
      lastName: 'Alami',
      gender: 'M',
      birthDate: '1974-01-01',
      cin: PATIENT_MOHAMED_ALAMI.cin,
      phone: PATIENT_MOHAMED_ALAMI.phone,
      email: PATIENT_MOHAMED_ALAMI.email,
      bloodGroup: PATIENT_MOHAMED_ALAMI.bloodGroup,
      allergies: [],
      antecedents: [],
      createdAt: '2024-01-01T00:00:00Z',
    },
    isLoading: false,
    error: null,
  }),
}));

function renderDossier(path = '/patients/PT-00482') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/patients/:id', element: <DossierPage /> },
      { path: '/patients', element: <DossierPage /> },
      { path: '/agenda', element: <div>Agenda</div> },
      { path: '/salle', element: <div>Salle</div> },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<DossierPage /> (desktop)', () => {
  it('renders Screen shell with Patients title and dossier sub', () => {
    const { container } = renderDossier();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent('Patients');
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('Mohamed Alami');
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('PT-00482');
  });

  it('renders patient name, sex/age pill and CIN pill in the header', () => {
    renderDossier();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText(/♂ Homme · 52 ans/)).toBeInTheDocument();
    expect(screen.getByText(/CIN BE 328451/)).toBeInTheDocument();
  });

  it('renders the allergy alert strip with Pénicilline', () => {
    renderDossier();
    const alert = screen.getByRole('alert', { name: 'Allergie connue' });
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Pénicilline');
    expect(alert).toHaveTextContent('réaction cutanée');
  });

  it('renders ATCD and Traitement chronique in the alert strip', () => {
    renderDossier();
    const alert = screen.getByRole('alert', { name: 'Allergie connue' });
    expect(alert).toHaveTextContent('HTA (2018), Dyslipidémie');
    expect(alert).toHaveTextContent('Amlodipine 5mg, Atorvastatine 20mg');
  });

  it('renders the 7 dossier tabs', () => {
    renderDossier();
    const tablist = screen.getByRole('tablist', { name: 'Sections du dossier patient' });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toHaveTextContent('Chronologie');
  });

  it('renders the Chronologie tab as active by default', () => {
    renderDossier();
    const chronoTab = screen.getByRole('tab', { name: /Chronologie/ });
    expect(chronoTab).toHaveAttribute('data-state', 'active');
  });

  it('renders the "Chronologie médicale" heading and timeline events', () => {
    renderDossier();
    expect(screen.getByText('Chronologie médicale')).toBeInTheDocument();
    // Multiple "Consultation de suivi" entries exist — use getAllByText
    expect(screen.getAllByText('Consultation de suivi').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bilan lipidique — Labo Atlas')).toBeInTheDocument();
    expect(screen.getByText('Certificat médical — sport')).toBeInTheDocument();
  });

  it('renders the "En cours" pill on the live consultation', () => {
    renderDossier();
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('renders the Constantes right-panel with TA warning', () => {
    renderDossier();
    expect(screen.getByText('Constantes — dernière visite')).toBeInTheDocument();
    expect(screen.getByText('135 / 85 mmHg')).toBeInTheDocument();
    expect(screen.getByText('27.4')).toBeInTheDocument();
  });

  it('renders the Traitement en cours panel with medication names', () => {
    renderDossier();
    expect(screen.getByText('Traitement en cours')).toBeInTheDocument();
    expect(screen.getByText('Amlodipine 5 mg')).toBeInTheDocument();
    expect(screen.getByText('Atorvastatine 20 mg')).toBeInTheDocument();
    expect(screen.getByText('Aspirine 100 mg')).toBeInTheDocument();
  });

  it('renders the action buttons: Imprimer, Modifier, Nouvelle consultation', () => {
    renderDossier();
    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Modifier/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouvelle consultation/ })).toBeInTheDocument();
  });

  it('switches to the Consultations tab on click', async () => {
    const user = userEvent.setup();
    renderDossier();
    const consultsTab = screen.getByRole('tab', { name: /Consultations/ });
    await user.click(consultsTab);
    expect(consultsTab).toHaveAttribute('data-state', 'active');
    expect(screen.getByText(/14 consultations/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderDossier();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Mobile smoke test ────────────────────────────────────
import DossierMobilePage from '../DossierPage.mobile';

function renderMobileDossier() {
  const router = createMemoryRouter(
    [
      { path: '/patients/:id', element: <DossierMobilePage /> },
      { path: '/patients', element: <DossierMobilePage /> },
      { path: '/agenda', element: <div>Agenda</div> },
    ],
    { initialEntries: ['/patients/PT-00482'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('<DossierMobilePage />', () => {
  it('renders mobile topbar with "Dossier patient" title', () => {
    const { container } = renderMobileDossier();
    expect(container.querySelector('.mt-title')).toHaveTextContent('Dossier patient');
  });

  it('renders patient header with name and mobile-verbatim meta', () => {
    renderMobileDossier();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    // Mobile prototype verbatim: "H · 58 ans · CIN BE 138 475"
    expect(screen.getByText('H · 58 ans · CIN BE 138 475')).toBeInTheDocument();
  });

  it('renders mobile allergy strip with Pénicilline', () => {
    renderMobileDossier();
    const alert = screen.getByRole('alert', { name: 'Allergie connue' });
    expect(alert).toHaveTextContent('Pénicilline');
  });

  it('renders 4 quick-action buttons', () => {
    renderMobileDossier();
    expect(screen.getByRole('button', { name: 'Appeler' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RDV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rx' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeInTheDocument();
  });

  it('renders the 3-item segmented control with Historique selected', () => {
    renderMobileDossier();
    const tablist = screen.getByRole('tablist', { name: 'Sections' });
    expect(tablist).toBeInTheDocument();
    const historique = screen.getByRole('tab', { name: 'Historique' });
    expect(historique).toHaveAttribute('aria-selected', 'true');
  });

  it('renders mobile timeline events', () => {
    renderMobileDossier();
    expect(screen.getByText(/TA 135\/85/)).toBeInTheDocument();
    expect(screen.getByText(/Cholestérol total 2.35/)).toBeInTheDocument();
  });

  it('renders Antécédents info card', () => {
    renderMobileDossier();
    expect(screen.getByText('HTA (2018), Dyslipidémie')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobileDossier();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
