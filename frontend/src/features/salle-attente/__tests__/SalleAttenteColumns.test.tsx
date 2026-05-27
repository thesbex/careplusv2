/**
 * QA9-11 — la salle d'attente se scinde en colonnes par médecin dès qu'il y a
 * ≥2 praticiens actifs ; chaque entrée est groupée par practitionerId, et les
 * entrées sans médecin tombent dans la colonne "Non affecté".
 *
 * QA9-12 — un seul praticien actif → table plate (pas de colonnes), preuve que
 * le seuil ≥2 est bien respecté.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { QueueEntry } from '../types';

const queue: QueueEntry[] = [
  {
    appointmentId: 'a1',
    patientId: 'p1',
    name: 'Salma Bennani',
    apt: '09:00',
    arrived: '09:05',
    status: 'arrived',
    waited: '6 min',
    room: '—',
    age: 30,
    reason: 'Suivi',
    practitionerId: 'doc-1',
    practitionerName: 'Dr Alami',
  },
  {
    appointmentId: 'a2',
    patientId: 'p2',
    name: 'Karim Idrissi',
    apt: '09:10',
    arrived: '09:12',
    status: 'arrived',
    waited: '4 min',
    room: '—',
    age: 45,
    reason: 'Première',
    practitionerId: 'doc-2',
    practitionerName: 'Dr Benani',
  },
  {
    appointmentId: 'a3',
    patientId: 'p3',
    name: 'Nadia Tazi',
    apt: '09:20',
    arrived: '09:21',
    status: 'arrived',
    waited: '1 min',
    room: '—',
    age: 22,
    reason: 'Certificat',
    practitionerId: null,
    practitionerName: null,
  },
];

const practitioners = [
  { id: 'doc-1', firstName: 'Yassine', lastName: 'Alami', specialty: null, active: true },
  { id: 'doc-2', firstName: 'Sara', lastName: 'Benani', specialty: null, active: true },
];

vi.mock('../hooks/useQueue', () => ({
  useQueue: () => ({
    queue,
    kpis: [
      { label: 'En attente', value: '3', sub: '' },
      { label: 'Attente moy.', value: '4', unit: 'min', sub: '' },
    ],
    upcoming: [],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../hooks/useUpcomingToday', () => ({
  useUpcomingToday: () => ({ upcoming: [] }),
}));
vi.mock('../hooks/useCheckIn', () => ({
  useCheckIn: () => ({ checkIn: vi.fn(), isPending: false, error: null }),
}));
vi.mock('../hooks/useStartConsultation', () => ({
  useStartConsultation: () => ({ startConsultation: vi.fn(), isPending: false, error: null }),
}));

let activePractitioners = practitioners;
vi.mock('@/features/agenda/hooks/usePractitioners', () => ({
  usePractitioners: () => ({ data: activePractitioners, isLoading: false, isError: false }),
}));

import SalleAttentePage from '../SalleAttentePage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/salle', element: <SalleAttentePage /> }], {
    initialEntries: ['/salle'],
  });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('SalleAttentePage — colonnes par médecin (QA9-11)', () => {
  it('scinde la file en colonnes quand ≥2 praticiens actifs', () => {
    activePractitioners = practitioners;
    renderPage();

    // Une région "par médecin" + une colonne par praticien + "Non affecté".
    expect(
      screen.getByRole('region', { name: /File d'attente par médecin/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Dr Alami')).toBeInTheDocument();
    expect(screen.getByText('Dr Benani')).toBeInTheDocument();
    expect(screen.getByText('Non affecté')).toBeInTheDocument();

    // Chaque patient apparaît dans sa colonne.
    expect(screen.getByText('Salma Bennani')).toBeInTheDocument();
    expect(screen.getByText('Karim Idrissi')).toBeInTheDocument();
    expect(screen.getByText('Nadia Tazi')).toBeInTheDocument();

    // La colonne Alami a sa propre liste de cartes aria-label-ée (cartes
    // compactes, plus la table large à 8 colonnes qui débordait à ~300px).
    expect(
      screen.getByRole('list', { name: /File d'attente — Dr Alami/i }),
    ).toBeInTheDocument();
  });

  it('reste en table plate avec un seul praticien actif (seuil ≥2)', () => {
    activePractitioners = [practitioners[0]!];
    renderPage();
    expect(
      screen.queryByRole('region', { name: /File d'attente par médecin/i }),
    ).not.toBeInTheDocument();
    // Table plate unique.
    expect(screen.getByRole('table', { name: /^File d'attente$/i })).toBeInTheDocument();
  });
});
