/**
 * Hook minimal pour le toggle "Cloisonnement" (V032 + V036).
 *
 * Lit `agendaStrictIsolation` + `vaccinationOrphanVisibleRoles` depuis
 * GET /api/settings/clinic ; le PUT préserve les autres champs côté serveur.
 * Le backend impose @NotBlank sur name/address/city/phone — on ne peut pas
 * envoyer un PUT minimal, on renvoie donc l'intégralité de la ligne avec
 * uniquement les flags modifiés.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type OrphanRole = 'MEDECIN' | 'ADMIN' | 'SECRETAIRE' | 'ASSISTANT';

interface ClinicSettingsRaw {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string | null;
  inpe: string | null;
  cnom: string | null;
  ice: string | null;
  rib: string | null;
  agendaStrictIsolation: boolean;
  /** V036 — codes de rôle voyant les patients sans médecin référent vaccination. */
  vaccinationOrphanVisibleRoles: OrphanRole[];
}

const DEFAULT_ORPHAN_ROLES: OrphanRole[] = ['MEDECIN', 'ADMIN', 'SECRETAIRE', 'ASSISTANT'];

export function useAgendaIsolation() {
  const { data, isLoading } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () =>
      api
        .get<ClinicSettingsRaw>('/settings/clinic')
        .then((r) => r.data)
        .catch(() => null),
    staleTime: 60_000,
  });
  return {
    settings: data ?? null,
    agendaStrictIsolation: data?.agendaStrictIsolation ?? false,
    vaccinationOrphanVisibleRoles:
      data?.vaccinationOrphanVisibleRoles ?? DEFAULT_ORPHAN_ROLES,
    isLoading,
  };
}

export function useUpdateAgendaIsolation() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      settings,
      agendaStrictIsolation,
      vaccinationOrphanVisibleRoles,
    }: {
      settings: ClinicSettingsRaw;
      agendaStrictIsolation?: boolean;
      vaccinationOrphanVisibleRoles?: OrphanRole[];
    }) => {
      const payload: Record<string, unknown> = {
        name: settings.name,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        email: settings.email ?? '',
        inpe: settings.inpe ?? '',
        cnom: settings.cnom ?? '',
        ice: settings.ice ?? '',
        rib: settings.rib ?? '',
        agendaStrictIsolation:
          agendaStrictIsolation ?? settings.agendaStrictIsolation,
      };
      if (vaccinationOrphanVisibleRoles !== undefined) {
        payload.vaccinationOrphanVisibleRoles = vaccinationOrphanVisibleRoles;
      }
      const r = await api.put<ClinicSettingsRaw>('/settings/clinic', payload);
      return r.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['clinic-settings'], data);
    },
  });
  return {
    updateAgendaIsolation: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
