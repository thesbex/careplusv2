/**
 * Wave 1 (2026-05-07) — auto-adaptive practitioner field on AppointmentDrawer.
 *
 * Asserts:
 *  - 1 active practitioner → field hidden, payload still carries the
 *    appointment's existing practitioner.
 *  - ≥ 2 active practitioners → field rendered.
 *  - Editing an existing appointment → field pre-filled with
 *    appointment.practitionerId.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth/authStore';

const moveAppointmentMock = vi.fn();
vi.mock('../hooks/useAppointmentMutations', () => ({
  useMoveAppointment: () => ({ moveAppointment: moveAppointmentMock, isPending: false }),
  useCancelAppointment: () => ({ cancelAppointment: vi.fn(), isPending: false }),
  extractConflictMessage: () => null,
}));

vi.mock('@/features/salle-attente/hooks/useCheckIn', () => ({
  useCheckIn: () => ({ checkIn: vi.fn(), isPending: false }),
}));

const usePractitionersMock = vi.fn();
vi.mock('../hooks/usePractitioners', () => ({
  usePractitioners: () => usePractitionersMock(),
}));

vi.mock('../hooks/useRooms', () => ({
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('../hooks/useRoomConflicts', () => ({
  useRoomConflicts: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { AppointmentDrawer } from '../components/AppointmentDrawer';
import type { Appointment } from '../types';

const MED_A = {
  id: 'med-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  firstName: 'Karim',
  lastName: 'Bennani',
  specialty: 'Pédiatre',
  active: true,
};
const MED_B = {
  id: 'med-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  firstName: 'Sara',
  lastName: 'Idrissi',
  specialty: null,
  active: true,
};

function appointmentWith(practitionerId: string): Appointment {
  return {
    id: 'appt-1111-1111-1111-111111111111',
    patientId: 'p1',
    practitionerId,
    startAt: '2026-05-12T09:00:00.000Z',
    durationMinutes: 30,
    day: 'mar',
    start: '09:00',
    dur: 30,
    patient: 'Mohamed Alami',
    reason: 'Suivi',
    status: 'confirmed',
    rawStatus: 'CONFIRME',
  };
}

function renderDrawer(appt: Appointment) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AppointmentDrawer open appointment={appt} onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  moveAppointmentMock.mockReset();
  moveAppointmentMock.mockResolvedValue({ id: 'appt-1111-1111-1111-111111111111' });
  usePractitionersMock.mockReset();
  useAuthStore.setState({
    accessToken: 't',
    user: {
      id: MED_A.id,
      email: 'k@x',
      firstName: 'K',
      lastName: 'B',
      roles: ['MEDECIN'],
    },
  });
});

describe('AppointmentDrawer — practitioner field (Wave 1)', () => {
  it('hides the practitioner field when only 1 active MEDECIN', async () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A],
      isLoading: false,
      isError: false,
    });
    renderDrawer(appointmentWith(MED_A.id));
    expect(screen.queryByLabelText('Médecin')).not.toBeInTheDocument();

    // Submitting still works and carries the appointment's practitioner.
    fireEvent.click(screen.getByRole('button', { name: /Déplacer le RDV/ }));
    await waitFor(() => expect(moveAppointmentMock).toHaveBeenCalled());
    const payload = moveAppointmentMock.mock.calls[0]?.[0];
    // When the field is hidden, the drawer should not change the
    // practitionerId (server keeps the existing one). Either omitted or
    // equals the existing — both acceptable.
    if (payload?.practitionerId !== undefined) {
      expect(payload.practitionerId).toBe(MED_A.id);
    }
  });

  it('renders the field when ≥ 2 active practitioners', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    renderDrawer(appointmentWith(MED_A.id));
    const select = screen.getByLabelText('Médecin') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe(MED_A.id);
  });

  it('pre-fills with appointment.practitionerId on edit (existing assignment)', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    // Even when the connected user is MED_A, an edit on a RDV owned by
    // MED_B must show MED_B as pre-filled (the data wins, not auth).
    renderDrawer(appointmentWith(MED_B.id));
    const select = screen.getByLabelText('Médecin') as HTMLSelectElement;
    expect(select.value).toBe(MED_B.id);
  });

  it('changing the practitioner sends the new id in the move payload', async () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    renderDrawer(appointmentWith(MED_A.id));
    const select = screen.getByLabelText('Médecin') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: MED_B.id } });
    fireEvent.click(screen.getByRole('button', { name: /Déplacer le RDV/ }));
    await waitFor(() => expect(moveAppointmentMock).toHaveBeenCalled());
    const payload = moveAppointmentMock.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({ practitionerId: MED_B.id }),
    );
  });
});
