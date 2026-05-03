import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface PatientListItem {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  cin: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  tier?: string | null;
  /** Document patient_document type=PHOTO courant (QA5-3). */
  photoDocumentId?: string | null;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

export function usePatientList(q: string) {
  const params = new URLSearchParams({ size: '40' });
  if (q.trim()) params.set('q', q.trim());

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients', q],
    queryFn: () =>
      api.get<Page<PatientListItem>>(`/patients?${params.toString()}`).then((r) => r.data),
    staleTime: 15_000,
  });

  return {
    patients: data?.content ?? [],
    total: data?.totalElements ?? 0,
    isLoading,
    error: error ? 'Impossible de charger la liste des patients.' : null,
  };
}
