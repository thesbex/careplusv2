import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Supprime une ordonnance (DELETE /prescriptions/{id}). Autorisé tant que la
 * consultation est en cours (BROUILLON) — le médecin peut s'être trompé de
 * prescription. Le serveur refuse (400) si la consultation est clôturée et
 * (409) si une ligne est déjà déposée en file interne LAB/RADIO.
 *
 * On invalide la liste des ordonnances de la consultation + les compteurs
 * d'onglets du dossier patient (où elles apparaissent aussi).
 */
export function useDeletePrescription(consultationId: string | undefined, patientId?: string) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (prescriptionId: string) => api.delete(`/prescriptions/${prescriptionId}`),
    onSuccess: () => {
      if (consultationId) {
        void qc.invalidateQueries({ queryKey: ['prescriptions', consultationId] });
      }
      if (patientId) {
        void qc.invalidateQueries({ queryKey: ['patient-tab-counts', patientId] });
      }
    },
  });
  return {
    remove: (prescriptionId: string) => mutation.mutateAsync(prescriptionId),
    isPending: mutation.isPending,
  };
}
