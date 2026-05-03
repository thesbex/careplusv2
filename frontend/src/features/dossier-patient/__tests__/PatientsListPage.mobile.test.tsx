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

  it('shows the desktop-creation hint message', () => {
    renderPage();
    expect(screen.getByText(/création de patient se fait depuis la version desktop/i)).toBeInTheDocument();
  });
});
