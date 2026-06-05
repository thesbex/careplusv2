import { useT } from '@/lib/i18n/I18nProvider';
import type { ReasonForAgenda } from '../hooks/useReasonsForAgenda';

interface AgendaLegendProps {
  /** Motifs réels (id, label, colorHex) — source de vérité des couleurs de blocs. */
  reasons: ReasonForAgenda[];
  /** Libellé de période affiché à droite (ex. « Semaine du 26 mai »). */
  periodLabel: string;
  /** Nombre de RDV de la période, pour le hint « · N RDV ». */
  count: number;
}

/**
 * Carte-légende « Types » posée au-dessus de la grille (iso maquette Calm
 * Premium `.aglegend`). Rend une carte blanche radius 14 + ombre douce avec :
 *   - un label « Types »
 *   - un item pastille+texte par motif réel (couleur = reason.colorHex,
 *     la même que la teinte de fond des blocs RDV — point 2 du port)
 *   - un hint aligné à droite « {période} · {N} RDV »
 *
 * Volontairement pilotée par les motifs backend plutôt que par 4 catégories
 * figées : la couleur d'un bloc vient de `reason.colorHex`, donc la légende
 * doit lister CES motifs-là pour rester un vrai code de lecture.
 */
export function AgendaLegend({ reasons, periodLabel, count }: AgendaLegendProps) {
  const { t } = useT();
  if (reasons.length === 0) return null;
  return (
    <div className="aglegend" aria-label={t('agenda.legend.types')}>
      <span className="aglegend-title">{t('agenda.legend.types')}</span>
      {reasons.map((r) => (
        <span key={r.id} className="aglegend-item">
          <span className="aglegend-dot" style={{ background: r.colorHex }} />
          {r.label}
        </span>
      ))}
      <span className="aglegend-hint">
        {periodLabel} · {t('agenda.grid.rdvCount', { n: count })}
      </span>
    </div>
  );
}
