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
  },
];

vi.mock('../hooks/usePatientList', () => ({
  usePatientList: () => ({
    patients: PATIENTS,
    total: PATIENTS.length,
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
  it('renders the brand topbar and bottom tabs', () => {
    const { container } = renderPage();
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('uses the .m-search class for search input (no hand-rolled icon overlay)', () => {
    const { container } = renderPage();
    expect(container.querySelector('label.m-search')).toBeInTheDocument();
    expect(screen.getByLabelText('Rechercher un patient')).toBeInTheDocument();
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
    // Premium badge is a text pill, NOT an emoji.
    const premium = screen.getByLabelText('Patient Premium');
    expect(premium).toHaveTextContent('Premium');
    expect(premium.textContent).not.toMatch(/🌟|⭐/);
  });

  it('navigates to patient dossier on row tap', () => {
    renderPage();
    fireEvent.click(screen.getByText('Mohamed Alami').closest('button.m-row')!);
    expect(screen.getByText('Dossier')).toBeInTheDocument();
  });

  it('exposes the « Nouveau patient » FAB to authorised users', () => {
    // Avant 2026-05-01 la création n'était pas faisable depuis mobile :
    // seul un message « la création se fait sur desktop » était rendu. Avec
    // NewPatientMobileSheet la création est désormais possible via le FAB +.
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
    // La sheet est portal'ed via radix Dialog. Le rôle dialog + les champs
    // requis suffisent à prouver qu'elle s'est bien montée.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom *')).toBeInTheDocument();
    expect(screen.getByLabelText('Téléphone *')).toBeInTheDocument();
    expect(screen.getByLabelText('Date de naissance *')).toBeInTheDocument();
  });
});
