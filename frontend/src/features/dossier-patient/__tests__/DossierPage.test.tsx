import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import DossierPage from '../DossierPage';
import { PATIENT_MOHAMED_ALAMI } from '../fixtures';

vi.mock('@/features/consultation/hooks/useConsultations', () => ({
  useConsultations: () => ({ consultations: [], isLoading: false, error: null, refetch: () => Promise.resolve() }),
}));

vi.mock('@/features/salle-attente/hooks/useStartConsultation', () => ({
  useStartConsultation: () => ({
    startConsultation: () => Promise.resolve({ id: 'c1' }),
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/features/prescription/hooks/usePrescriptions', () => ({
  usePrescriptionsForPatient: () => ({ prescriptions: [], isLoading: false, error: null }),
  usePrescriptions: () => ({ prescriptions: [], isLoading: false }),
  usePrescription: () => ({ prescription: null, isLoading: false, error: null }),
}));

vi.mock('@/features/facturation/hooks/useInvoices', () => ({
  useInvoicesForPatient: () => ({ invoices: [], isLoading: false, error: null }),
  useInvoices: () => ({ invoices: [], isLoading: false, error: null, refetch: () => Promise.resolve() }),
  useInvoice: () => ({ invoice: null, isLoading: false, error: null, refetch: () => Promise.resolve() }),
  useInvoiceByConsultation: () => ({ invoice: null, isLoading: false }),
}));

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

  it('renders the 8 dossier tabs (incl. Constantes)', () => {
    renderDossier();
    const tablist = screen.getByRole('tablist', { name: 'Sections du dossier patient' });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(8);
    expect(tabs[0]).toHaveTextContent('Chronologie');
    expect(tabs[2]).toHaveTextContent('Constantes');
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
    // useConsultations mocked to []; empty state displays.
    expect(screen.getByText(/Aucune consultation enregistrée/)).toBeInTheDocument();
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
  // DossierPage.mobile rend EditPatientMobileSheet, qui utilise useMutation
  // (useUpdatePatient + usePatientPhoto) — donc on a besoin d'un QueryClient.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<DossierMobilePage />', () => {
  it('renders mobile topbar with "Dossier patient" title', () => {
    const { container } = renderMobileDossier();
    expect(container.querySelector('.mt-title')).toHaveTextContent('Dossier patient');
  });

  it('renders patient header with name and meta derived from the patient record', () => {
    renderMobileDossier();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    // Meta is now `${sex} · ${age} ans · CIN ${cin}` from the real patient
    // record. Fixture: sex='Homme', age=52, cin='BE 328451'.
    expect(screen.getByText('Homme · 52 ans · CIN BE 328451')).toBeInTheDocument();
  });

  it('renders mobile allergy strip with Pénicilline', () => {
    renderMobileDossier();
    const alert = screen.getByRole('alert', { name: 'Allergie connue' });
    expect(alert).toHaveTextContent('Pénicilline');
  });

  it('renders the wired quick-action buttons (Appeler + RDV)', () => {
    renderMobileDossier();
    // Appeler renders as <a tel:…> if patient.phone exists, else as a disabled button.
    const appeler =
      screen.queryByRole('link', { name: /Appeler/ }) ??
      screen.getByRole('button', { name: /Appeler/ });
    expect(appeler).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prendre un rendez-vous' })).toBeInTheDocument();
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

  it('opens the EditPatientMobileSheet from the topbar pencil icon', async () => {
    // Avant 2026-05-02 il n'y avait aucun bouton « Modifier » sur mobile.
    // Le crayon dans le right-slot du MTopbar ouvre la sheet pré-remplie.
    const user = userEvent.setup();
    renderMobileDossier();
    const editBtn = screen.getByRole('button', { name: /Modifier le patient/i });
    expect(editBtn).toBeInTheDocument();
    await user.click(editBtn);

    // La sheet se monte (radix Dialog → role="dialog") avec les champs pré-remplis.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const phoneInput = screen.getByLabelText('Téléphone *');
    expect((phoneInput as HTMLInputElement).value.length).toBeGreaterThan(0);
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobileDossier();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
