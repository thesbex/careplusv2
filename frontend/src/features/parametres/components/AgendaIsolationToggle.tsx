/**
 * Toggle "Cloisonnement" (V032 agendas + V036 queue Vaccination).
 *
 * Auto-hide si <2 médecins actifs : un cabinet 1 médecin n'a aucun usage
 * pour la flag (impossible de cloisonner à 1).
 *
 * Quand activé :
 *  - chaque MEDECIN ne voit que son propre agenda + ses créneaux ;
 *  - la queue Vaccination ne montre que les patients qu'il « suit » (au
 *    moins 1 action sur une dose) + les patients orphelins selon la
 *    configuration `vaccinationOrphanVisibleRoles`.
 * Désactivé (par défaut), tout est partagé — le mode pratique pour des
 * cabinets de 2-3 généralistes qui se coordonnent.
 */
import { toast } from 'sonner';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import {
  useAgendaIsolation,
  useUpdateAgendaIsolation,
} from '../hooks/useAgendaIsolation';
import { usePractitioners } from '../hooks/usePractitioners';

export function AgendaIsolationToggle() {
  const { practitioners } = usePractitioners();
  const { settings, agendaStrictIsolation, isLoading } = useAgendaIsolation();
  const { updateAgendaIsolation, isPending } = useUpdateAgendaIsolation();
  const isAdminOrDoctor = useAuthStore(
    (s) =>
      (s.user?.roles.includes('ADMIN') ?? false) ||
      (s.user?.roles.includes('MEDECIN') ?? false),
  );

  // Auto-hide quand <2 médecins actifs.
  const activeCount = practitioners.filter((p) => p.active).length;
  if (activeCount < 2) return null;

  async function handleToggle(next: boolean) {
    if (!settings) {
      toast.error('Paramètres cabinet non chargés.');
      return;
    }
    try {
      await updateAgendaIsolation({
        settings,
        agendaStrictIsolation: next,
      });
      toast.success(
        next
          ? 'Cloisonnement activé — chaque médecin ne voit plus que son agenda.'
          : 'Cloisonnement désactivé — agendas partagés.',
      );
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  }

  return (
    <Panel data-testid="agenda-isolation-toggle">
      <PanelHeader>Cloisonnement (agendas, vaccinations)</PanelHeader>
      <div style={{ padding: 16 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: isAdminOrDoctor ? 'pointer' : 'not-allowed',
          }}
        >
          <input
            type="checkbox"
            role="switch"
            checked={agendaStrictIsolation}
            disabled={!isAdminOrDoctor || isPending || isLoading}
            onChange={(e) => void handleToggle(e.target.checked)}
            aria-label="Activer le cloisonnement"
            style={{ width: 18, height: 18, marginTop: 2 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {agendaStrictIsolation ? 'Activé' : 'Désactivé'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                marginTop: 4,
                lineHeight: 1.5,
              }}
            >
              Quand activé, chaque médecin ne voit que son propre agenda et la
              queue Vaccination filtre sur les patients qu'il suit. Désactivé
              (par défaut), tout est partagé entre médecins du cabinet.
            </div>
          </div>
        </label>
      </div>
    </Panel>
  );
}
