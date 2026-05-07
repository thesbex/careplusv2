/**
 * Hook minimal pour le toggle "Cloisonnement des agendas" (V032).
 *
 * Lit `agendaStrictIsolation` depuis GET /api/settings/clinic ; le PUT préserve
 * les autres champs côté serveur quand le payload n'envoie que ce champ +
 * les champs obligatoires pour le validator. On renvoie les autres champs
 * tels qu'ils ont été lus pour rester sûr (le validator backend impose @NotBlank
 * sur name/address/city/phone — on ne peut pas envoyer un PUT minimal).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

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
}

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
    isLoading,
  };
}

export function useUpdateAgendaIsolation() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      settings,
      agendaStrictIsolation,
    }: {
      settings: ClinicSettingsRaw;
      agendaStrictIsolation: boolean;
    }) => {
      // Le backend impose @NotBlank sur les identifiants cabinet — on renvoie
      // donc l'intégralité de la ligne avec uniquement la flag modifiée.
      const payload = {
        name: settings.name,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        email: settings.email ?? '',
        inpe: settings.inpe ?? '',
        cnom: settings.cnom ?? '',
        ice: settings.ice ?? '',
        rib: settings.rib ?? '',
        agendaStrictIsolation,
      };
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
