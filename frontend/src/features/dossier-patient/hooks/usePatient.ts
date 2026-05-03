import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PatientSummary } from '../types';

interface PatientViewApi {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  cin: string | null;
  phone: string | null;
  email: string | null;
  bloodGroup: string | null;
  allergies: { id: string; substance: string; severity: string; notes: string | null }[];
  antecedents: { id: string; type: string; description: string }[];
  createdAt: string;
}

function toAge(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function adapt(v: PatientViewApi): PatientSummary {
  return {
    id: v.id,
    dossierNo: v.id.slice(0, 8).toUpperCase(),
    initials: `${v.firstName.charAt(0)}${v.lastName.charAt(0)}`.toUpperCase(),
    fullName: `${v.firstName} ${v.lastName}`,
    sex: v.gender === 'M' ? 'H' : v.gender === 'F' ? 'F' : v.gender,
    age: v.birthDate ? toAge(v.birthDate) : 0,
    cin: v.cin ?? '—',
    birthDate: v.birthDate ?? '',
    phone: v.phone ?? '—',
    email: v.email ?? '—',
    bloodGroup: v.bloodGroup ?? '—',
    insurance: '—',
    allergies: v.allergies.map((a) => a.substance),
    allergyNotes: v.allergies.map((a) => a.notes).filter(Boolean).join('; '),
    antecedents: v.antecedents
      .filter((a) => a.type !== 'TRAITEMENT_CHRONIQUE')
      .map((a) => a.description)
      .join('\n'),
    chronicTreatment: v.antecedents
      .filter((a) => a.type === 'TRAITEMENT_CHRONIQUE')
      .map((a) => a.description)
      .join('\n'),
    timeline: [],
    lastVitals: [],
    lastVitalsDate: '',
    currentMedications: [],
    currentMedicationsSince: '',
    admin: [
      { k: 'Date création', v: new Date(v.createdAt).toLocaleDateString('fr-MA') },
    ],
  };
}

export type { PatientViewApi };

export function usePatient(id?: string): {
  patient: PatientSummary | null;
  raw: PatientViewApi | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get<PatientViewApi>(`/patients/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });

  return {
    patient: data ? adapt(data) : null,
    raw: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger le dossier patient.' : null,
  };
}
