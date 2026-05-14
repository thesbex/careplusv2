import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type Segment = 'tous' | 'recent' | 'chroniques' | 'nouveaux';

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
  /** When the patient record was created — used by the "Nouveau" pill. */
  createdAt?: string | null;
  /** ISO timestamp of the most recent consultation (any practitioner). */
  lastVisitAt?: string | null;
  /** ISO timestamp of the next non-cancelled appointment. */
  nextAppointmentAt?: string | null;
  /** At least one chronic antecedent (PERSONNEL_MALADIES_CHRONIQUES). */
  chronic?: boolean;
  /** At least one allergy on file — drives the amber warning pill. */
  allergy?: boolean;
  /** Active EN_COURS pregnancy — drives the "Grossesse" pill. */
  pregnant?: boolean;
  /** Patient created < 30 days ago. */
  isNew?: boolean;
  /** Short tag list (chronic antecedents first, then Grossesse if room). */
  tags?: string[];
}

export interface SegmentCounts {
  tous: number;
  recent: number;
  chroniques: number;
  nouveaux: number;
}

interface ListPage {
  content: PatientListItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  counts: SegmentCounts;
}

export interface UsePatientListOptions {
  q?: string;
  segment?: Segment;
  gender?: 'M' | 'F' | 'O';
  ageMin?: number;
  ageMax?: number;
  page?: number;
  size?: number;
}

const EMPTY_COUNTS: SegmentCounts = { tous: 0, recent: 0, chroniques: 0, nouveaux: 0 };

/**
 * Patients list screen (05a) data source. Calls /api/patients/list which
 * bundles the page + segment counts in one round-trip.
 *
 * Back-compat: signature accepts either a bare query string (legacy callers)
 * or an options bag. Legacy callers default to segment="tous", page 0, size 40.
 */
export function usePatientList(input: string | UsePatientListOptions = '') {
  const opts: UsePatientListOptions = typeof input === 'string' ? { q: input } : input;
  const {
    q = '',
    segment = 'tous',
    gender,
    ageMin,
    ageMax,
    page = 0,
    size = 40,
  } = opts;

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  params.set('segment', segment);
  if (gender) params.set('gender', gender);
  if (ageMin != null) params.set('ageMin', String(ageMin));
  if (ageMax != null) params.set('ageMax', String(ageMax));
  params.set('page', String(page));
  params.set('size', String(size));

  const { data, isLoading, error } = useQuery({
    queryKey: ['patients-list', q.trim(), segment, gender ?? null, ageMin ?? null, ageMax ?? null, page, size],
    queryFn: () =>
      api.get<ListPage>(`/patients/list?${params.toString()}`).then((r) => r.data),
    staleTime: 15_000,
  });

  return {
    patients: data?.content ?? [],
    total: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    page: data?.number ?? 0,
    size: data?.size ?? size,
    counts: data?.counts ?? EMPTY_COUNTS,
    isLoading,
    error: error ? 'Impossible de charger la liste des patients.' : null,
  };
}
