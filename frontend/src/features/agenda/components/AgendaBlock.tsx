import { Warn } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { pxFromMin, topPxAt, DEFAULT_FIRST_HOUR } from '../fixtures';
import type { Appointment } from '../types';

interface AgendaBlockProps {
  a: Appointment;
  onClick?: (a: Appointment) => void;
  /** When true, enable HTML5 drag-and-drop to allow moving the block. */
  draggable?: boolean;
  /**
   * R053 — couleur du motif de prestation (Contrôle / Première visite / Urgence
   * / Certificat…). Rendue en bord gauche du bloc pour ajouter un 2e axe d'info
   * sans masquer le code couleur du statut (consult/arrived/done) qui reste
   * porté par le fond.
   */
  reasonColor?: string;
  /** RDV planifié mais passé l'heure → bord/temps corail. Calculé en amont. */
  late?: boolean;
  /** Indice de colonne (0..colCount-1) calculé par assignColumns pour le rendu
      côte-à-côte en cas de chevauchement. Par défaut 0. */
  colIndex?: number;
  /** Nombre de colonnes du cluster de chevauchement. Par défaut 1. */
  colCount?: number;
  /** Mini-avatar médecin (iso maquette user 2026-05-28 vue Semaine multi-doc).
      Initiales + couleur dans une pastille à gauche du temps. Affiché seulement
      si fourni par AgendaGrid (qui ne le passe qu'en multi-praticien). */
  practitioner?: { initials: string; color: string; name: string };
  /** Première heure affichée par la grille (origine du positionnement vertical).
      AgendaGrid l'élargit < 8h ou > 19h pour englober les RDV hors plage. */
  firstHour?: number;
}

/**
 * A single appointment block placed inside an .ag-daycol column. Handles the
 * compact (≤15-min) layout variant which lays out time + name + allergy dot
 * inline because a 15-min slot is only 18px tall.
 * Ported from design/prototype/screens/agenda.jsx:AgendaBlock.
 */
/**
 * Clé i18n du statut affiché dans le tooltip hover. Doublon assumé avec la
 * légende couleur (qui code la même chose visuellement) — le tooltip rend la
 * sémantique explicite pour l'utilisateur qui survole une carte trop étroite
 * pour montrer tous ses détails (cas low-res / collisions 3+).
 */
const STATUS_KEY: Record<string, string> = {
  confirmed: 'agenda.status.confirmed',
  arrived: 'agenda.status.arrived',
  vitals: 'agenda.status.waitingVitals',
  consult: 'agenda.status.consult',
  done: 'agenda.status.done',
};

export function AgendaBlock({ a, onClick, draggable, reasonColor, late = false, colIndex = 0, colCount = 1, practitioner, firstHour = DEFAULT_FIRST_HOUR }: AgendaBlockProps) {
  const { t } = useT();
  // 1px inset top + bottom (was 2+2). Borders on the block already provide
  // visual separation between adjacent slots, so a 2px total gap is enough —
  // the 4px reservation was eating into the per-block padding budget and
  // making 30-min slots feel cramped.
  const top = topPxAt(a.start, firstHour) + 1;
  const height = pxFromMin(a.dur) - 2;
  // Block-density tiers based on slot height:
  //   ≤15min  → compact   : time + name inline (one row, ~14px usable)
  //   16-30   → medium    : time + name stacked, no reason (32px usable)
  //   >30     → full      : time + name + reason (3 lines, design default)
  // 30-min blocks (most common) used to render the 3-line layout, which
  // overflows their 32px box — the reason line crashed into the next slot.
  const compact = a.dur <= 15;
  const medium = !compact && a.dur <= 30;
  const cls = `ag-block ag-${a.status}${compact ? ' ag-compact' : ''}${medium ? ' ag-medium' : ''}${late ? ' ag-late' : ''}${reasonColor ? ' ag-reason-tinted' : ''}`;
  // Layout côte-à-côte : pourcentage de la colonne occupé par ce bloc + offset
  // selon colIndex. Plus le cluster est dense, plus chaque bloc est étroit.
  // Inset latéral de 4px conservé (ag-block left: 4px) pour le rendu mono-bloc.
  const widthPct = 100 / Math.max(1, colCount);
  const leftPct = widthPct * colIndex;
  const colStyle = colCount > 1
    ? { left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)`, right: 'auto' as const }
    : {};
  // Tooltip hover natif — couvre le cas low-res / collisions 3+ où le texte
  // tronqué cache l'info (cf. user feedback 2026-05-28). Pas de JS, pas de
  // CSS popover : le browser fait le rendu, accessible OS-natif, gratuit.
  const statusLabel = late
    ? t('agenda.status.late')
    : (STATUS_KEY[a.status] ? t(STATUS_KEY[a.status]!) : a.status);
  const titleLines = [
    `${a.patient}`,
    `${a.start} · ${a.dur} min — ${statusLabel}`,
    a.reason ? t('agenda.tooltip.reason', { reason: a.reason }) : null,
    practitioner ? t('agenda.tooltip.doctor', { name: practitioner.name }) : null,
    a.allergy ? t('agenda.tooltip.allergy', { allergy: a.allergy }) : null,
  ].filter(Boolean);
  const tooltip = titleLines.join('\n');
  return (
    <button
      type="button"
      className={cls}
      style={{
        top,
        height,
        ...colStyle,
        ...(reasonColor ? { borderLeft: `3px solid ${reasonColor}`, background: `color-mix(in srgb, ${reasonColor} 13%, var(--ds2-surface, #fff))` } : {}),
      }}
      onClick={() => onClick?.(a)}
      title={tooltip}
      aria-label={
        late
          ? t('agenda.block.ariaLate', { patient: a.patient, start: a.start, reason: a.reason })
          : t('agenda.block.aria', { patient: a.patient, start: a.start, reason: a.reason })
      }
      draggable={draggable && !!a.id}
      onDragStart={(e) => {
        if (!draggable || !a.id) return;
        // Store the appointment id; the daycol drop handler reads it back.
        e.dataTransfer.setData('text/plain', a.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {compact ? (
        <>
          {practitioner && (
            <span
              className="ag-doctor-avatar"
              style={{ background: practitioner.color }}
              title={practitioner.name}
              aria-label={practitioner.name}
            >
              {practitioner.initials}
            </span>
          )}
          <div className="ag-time tnum">{a.start}</div>
          <div className="ag-name">{a.patient}</div>
          {a.allergy && (
            <span className="ag-allergy-dot" title={t('agenda.block.allergyTitle', { allergy: a.allergy })}>
              <Warn />
            </span>
          )}
        </>
      ) : (
        <>
          <div className="ag-block-head">
            {practitioner && (
              <span
                className="ag-doctor-avatar"
                style={{ background: practitioner.color }}
                title={practitioner.name}
                aria-label={practitioner.name}
              >
                {practitioner.initials}
              </span>
            )}
            <div className="ag-time tnum">
              {a.start} · {a.dur}min
            </div>
          </div>
          <div className="ag-name">{a.patient}</div>
          <div className="ag-reason">{a.reason}</div>
          {a.allergy && (
            <div className="ag-allergy" title={t('agenda.block.allergyTitle', { allergy: a.allergy })}>
              <Warn /> <span>{a.allergy}</span>
            </div>
          )}
        </>
      )}
    </button>
  );
}
