/**
 * Wave 1 (2026-05-07) — auto-adaptive room dropdown on AppointmentDrawer.
 *
 * Asserts:
 *  - 0 or 1 active room → field hidden.
 *  - ≥ 2 active rooms → field rendered with "Aucune" + each room option.
 *  - Submit with roomId → moveAppointment payload contains roomId.
 *  - Non-empty room conflicts after save → warning banner shown.
 *  - Empty room conflicts → no banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ────────────────────────────────────────────────────────────────
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

const useRoomsMock = vi.fn();
vi.mock('../hooks/useRooms', () => ({
  useRooms: () => useRoomsMock(),
}));

const useRoomConflictsMock = vi.fn();
vi.mock('../hooks/useRoomConflicts', () => ({
  useRoomConflicts: (params: { appointmentId: string | null; roomId: string | null }) =>
    useRoomConflictsMock(params),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// ── Imports after mocks ──────────────────────────────────────────────────
import { AppointmentDrawer } from '../components/AppointmentDrawer';
import type { Appointment } from '../types';

const ROOM_A = {
  id: 'room-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Salle 1',
  capabilityTags: ['écho'],
  active: true,
};
const ROOM_B = {
  id: 'room-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  name: 'Salle 2',
  capabilityTags: [],
  active: true,
};

const APPT: Appointment = {
  id: 'appt-1111-1111-1111-111111111111',
  patientId: 'p1',
  practitionerId: 'doc1',
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

function renderDrawer() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AppointmentDrawer open appointment={APPT} onOpenChange={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  moveAppointmentMock.mockReset();
  moveAppointmentMock.mockResolvedValue({ id: APPT.id, roomId: ROOM_A.id });
  usePractitionersMock.mockReset();
  usePractitionersMock.mockReturnValue({ data: [], isLoading: false, isError: false });
  useRoomsMock.mockReset();
  useRoomConflictsMock.mockReset();
  useRoomConflictsMock.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe('AppointmentDrawer — room field (Wave 1)', () => {
  it('hides the room field when 0 rooms', () => {
    useRoomsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderDrawer();
    expect(screen.queryByLabelText('Salle')).not.toBeInTheDocument();
  });

  it('hides the room field when only 1 active room', () => {
    useRoomsMock.mockReturnValue({ data: [ROOM_A], isLoading: false, isError: false });
    renderDrawer();
    expect(screen.queryByLabelText('Salle')).not.toBeInTheDocument();
  });

  it('renders the field with "Aucune" + room options when ≥ 2 rooms', () => {
    useRoomsMock.mockReturnValue({
      data: [ROOM_A, ROOM_B],
      isLoading: false,
      isError: false,
    });
    renderDrawer();
    const select = screen.getByLabelText('Salle') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent ?? '');
    expect(labels[0]).toMatch(/Aucune/);
    expect(labels.find((l) => l.includes('Salle 1'))).toBeTruthy();
    expect(labels.find((l) => l.includes('Salle 2'))).toBeTruthy();
    // capability tag surfaced inline.
    expect(labels.find((l) => l.includes('écho'))).toBeTruthy();
  });

  it('submits with roomId in the payload when a room is picked', async () => {
    useRoomsMock.mockReturnValue({
      data: [ROOM_A, ROOM_B],
      isLoading: false,
      isError: false,
    });
    renderDrawer();
    const select = screen.getByLabelText('Salle') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: ROOM_A.id } });
    fireEvent.click(screen.getByRole('button', { name: /Déplacer le RDV/ }));

    await waitFor(() => expect(moveAppointmentMock).toHaveBeenCalled());
    const payload = moveAppointmentMock.mock.calls[0]?.[0];
    expect(payload).toEqual(expect.objectContaining({ roomId: ROOM_A.id }));
  });

  it('renders the conflict warning banner when room-conflicts is non-empty', () => {
    useRoomsMock.mockReturnValue({
      data: [ROOM_A, ROOM_B],
      isLoading: false,
      isError: false,
    });
    useRoomConflictsMock.mockReturnValue({
      data: [
        {
          conflictAppointmentId: 'c1',
          conflictPatientLastName: 'Other',
          conflictPatientFirstName: 'Bob',
          conflictStartAt: '2026-05-12T09:00:00.000Z',
          conflictEndAt: '2026-05-12T09:30:00.000Z',
          conflictPractitionerId: 'doc2',
          conflictPractitionerLastName: 'Idrissi',
          conflictPractitionerFirstName: 'Sara',
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderDrawer();
    expect(screen.getByRole('alert', { name: 'Conflit salle' })).toBeInTheDocument();
    expect(screen.getByText(/Idrissi/)).toBeInTheDocument();
  });

  it('does NOT render the conflict banner when room-conflicts is empty', () => {
    useRoomsMock.mockReturnValue({
      data: [ROOM_A, ROOM_B],
      isLoading: false,
      isError: false,
    });
    useRoomConflictsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderDrawer();
    expect(screen.queryByRole('alert', { name: 'Conflit salle' })).not.toBeInTheDocument();
  });
});
