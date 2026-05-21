import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiPatientThread } from '../api-types';
import type { PatientThread } from '../types';

export function usePatientThreads() {
  return useQuery({
    queryKey: ['chat', 'patient-threads'],
    queryFn: () =>
      api.get<ApiPatientThread[]>('/chat/patient-threads').then((r) =>
        r.data.map<PatientThread>((p) => ({
          id: p.id,
          patient: p.patient,
          pid: p.pid,
          subj: p.subj,
          participants: p.participants,
          time: p.time,
          open: p.open,
          color: p.color,
        })),
      ),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
