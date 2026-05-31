import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PatientCandidate } from '../types';

interface PatientSummaryApi {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  birthDate: string | null;
}

interface Page<T> { content: T[] }

/** Computes the age in years from a birthdate. Returns null when unknown so the
 *  caller can localize the "{n} ans" label via t('rdv.years', { n }). */
function toAgeYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() - d.getMonth() < 0) age--;
  return age;
}

export function usePatientSearch(query: string): {
  candidates: PatientCandidate[];
  isLoading: boolean;
  error: string | null;
} {
  const trimmed = query.trim();

  const { data, isLoading, error } = useQuery({
    queryKey: ['patient-search', trimmed],
    queryFn: () =>
      api
        .get<Page<PatientSummaryApi>>(`/patients?q=${encodeURIComponent(trimmed)}&size=10`)
        .then((r) => r.data),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });

  const candidates: PatientCandidate[] = (data?.content ?? []).map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    phone: p.phone ?? '—',
    lastVisit: '',
    tags: [],
    // Age unit localized at render time via t('rdv.years', { n }) (#122).
    ageYears: toAgeYears(p.birthDate),
  }));

  return {
    candidates: trimmed.length < 2 ? [] : candidates,
    isLoading,
    // i18n (#122) : clé de traduction (le consommateur fait t()).
    error: error ? 'rdv.err.search' : null,
  };
}
