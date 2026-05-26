/**
 * QA9-12 — AddWalkInDialog : sélection patient + médecin → POST /appointments
 * (walkIn:true, urgency:true) puis POST /appointments/{id}/check-in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPost = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('@/features/prise-rdv/hooks/usePatientSearch', () => ({
  usePatientSearch: (q: string) => ({
    candidates:
      q.trim().length >= 2
        ? [{ id: 'pat-1', name: 'Salma Bennani', phone: '0600', lastVisit: '', tags: [] }]
        : [],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('@/features/prise-rdv/hooks/useReasons', () => ({
  useReasons: () => ({
    reasons: [{ id: 'r1', label: 'Consultation' }],
    isLoading: false,
    error: null,
  }),
}));
vi.mock('@/features/agenda/hooks/usePractitioners', () => ({
  usePractitioners: () => ({
    data: [
      { id: 'doc-1', firstName: 'Yassine', lastName: 'Alami', specialty: null, active: true },
      { id: 'doc-2', firstName: 'Sara', lastName: 'Benani', specialty: null, active: true },
    ],
    isLoading: false,
    isError: false,
  }),
}));

import { AddWalkInDialog } from '../AddWalkInDialog';

function renderDialog() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const onAdded = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <AddWalkInDialog open onOpenChange={onOpenChange} onAdded={onAdded} />
    </QueryClientProvider>,
  );
  return { onOpenChange, onAdded };
}

beforeEach(() => {
  mockPost.mockReset();
  // First call (create appointment) returns the new id; check-in returns void.
  mockPost.mockResolvedValueOnce({ data: { id: 'apt-new' } }).mockResolvedValueOnce({ data: {} });
});

describe('<AddWalkInDialog /> (QA9-12)', () => {
  it('poste un walk-in + check-in avec le médecin choisi', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onAdded } = renderDialog();

    // Search a patient and select them.
    await user.type(screen.getByLabelText('Rechercher un patient'), 'Sal');
    await user.click(screen.getByRole('option', { name: /Salma Bennani/ }));

    // Pick the second doctor.
    await user.selectOptions(screen.getByLabelText('Médecin'), 'doc-2');

    await user.click(screen.getByRole('button', { name: /Ajouter à la salle/ }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));

    // 1st call → POST /appointments with walkIn + urgency + chosen practitioner.
    const [firstUrl, firstBody] = mockPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(firstUrl).toBe('/appointments');
    expect(firstBody).toMatchObject({
      walkIn: true,
      urgency: true,
      patientId: 'pat-1',
      practitionerId: 'doc-2',
      durationMinutes: 30,
    });
    expect(typeof firstBody.startAt).toBe('string');

    // 2nd call → POST /appointments/apt-new/check-in.
    const [secondUrl] = mockPost.mock.calls[1] as [string];
    expect(secondUrl).toBe('/appointments/apt-new/check-in');

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('bloque la soumission tant qu\'aucun patient n\'est sélectionné', async () => {
    renderDialog();
    const btn = screen.getByRole('button', { name: /Ajouter à la salle/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
