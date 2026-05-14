import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PatientsListMobilePage from '../PatientsListPage.mobile';

const PATIENTS = [
  {
    id: 'p1',
    firstName: 'Mohamed',
    lastName: 'Alami',
    gender: 'M',
    birthDate: '1974-01-01',
    cin: 'BE328451',
    phone: '+212 600 000 000',
    city: 'Casablanca',
    status: 'ACTIVE',
    tier: 'PREMIUM',
    allergy: true,
    chronic: true,
    tags: ['HTA'],
  },
  {
    id: 'p2',
    firstName: 'Fatima',
    lastName: 'Lahlou',
    gender: 'F',
    birthDate: '1990-04-04',
    cin: null,
    phone: null,
    city: null,
    status: 'ACTIVE',
    tier: 'NORMAL',
    isNew: true,
    tags: [],
  },
];

vi.mock('../hooks/usePatientList', () => ({
  usePatientList: () => ({
    patients: PATIENTS,
    total: PATIENTS.length,
    totalPages: 1,
    page: 0,
    size: 100,
    counts: { tous: 2, recent: 0, chroniques: 1, nouveaux: 1 },
    isLoading: false,
    error: null,
  }),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/patients', element: <PatientsListMobilePage /> },
      { path: '/patients/:id', element: <div>Dossier</div> },
      { path: '/agenda', element: <div>Agenda</div> },
    ],
    { initialEntries: ['/patients'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<PatientsListMobilePage /> — NRG', () => {
  it('renders the Patients topbar with the dossier count and bottom tabs', () => {
    const { container } = renderPage();
    // Title "Patients" + sub "2 dossiers" come from MTopbar — the brand
    // chip is gone since the M05a refonte (2026-05-10).
    const title = container.querySelector('.mt-title');
    expect(title).toHaveTextContent('Patients');
    expect(container.querySelector('.mt-sub')).toHaveTextContent(/2 dossiers/i);
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('uses the .m-search class for search input', () => {
    const { container } = renderPage();
    expect(container.querySelector('label.m-search')).toBeInTheDocument();
    expect(screen.getByLabelText('Rechercher un patient')).toBeInTheDocument();
  });

  it('renders the segmented filter [Tous / Chroniques / Nouveaux] with counts', () => {
    renderPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Tous2',
      'Chroniques1',
      'Nouveaux1',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('renders patient rows inside an .m-card with .m-row tappable buttons', () => {
    const { container } = renderPage();
    const card = container.querySelector('.m-card');
    expect(card).toBeInTheDocument();
    const rows = card!.querySelectorAll('button.m-row');
    expect(rows).toHaveLength(2);
  });

  it('renders patient name + meta line + premium pill (no emoji)', () => {
    renderPage();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText('Fatima Lahlou')).toBeInTheDocument();
    const premium = screen.getByLabelText('Patient Premium');
    expect(premium).toHaveTextContent('Premium');
    expect(premium.textContent).not.toMatch(/🌟|⭐/);
  });

  it('renders the amber allergy indicator on patients with allergies', () => {
    renderPage();
    expect(screen.getByLabelText('Allergie connue')).toBeInTheDocument();
  });

  it('renders the "Nouveau" pill on new patients', () => {
    renderPage();
    // The "Vu : Nouveau" line on patients with no visit history also reads
    // "Nouveau", so we scope the assertion to the .m-pill bubble.
    expect(screen.getByText('Nouveau', { selector: '.m-pill' })).toBeInTheDocument();
  });

  it('navigates to patient dossier on row tap', () => {
    renderPage();
    fireEvent.click(screen.getByText('Mohamed Alami').closest('button.m-row')!);
    expect(screen.getByText('Dossier')).toBeInTheDocument();
  });

  it('exposes the « Nouveau patient » FAB to authorised users', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Nouveau patient/i })).toBeInTheDocument();
  });

  it('points to the desktop variant for the dense fields (allergies, mutuelle, …)', () => {
    renderPage();
    expect(screen.getByText(/version desktop/i)).toBeInTheDocument();
  });

  it('opens the NewPatientMobileSheet when the FAB is tapped', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Nouveau patient/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom *')).toBeInTheDocument();
    expect(screen.getByLabelText('Téléphone *')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de naissance *')).toBeInTheDocument();
  });
});
