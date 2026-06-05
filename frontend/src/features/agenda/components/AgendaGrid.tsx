import { AgendaBlock } from './AgendaBlock';
import { useT } from '@/lib/i18n/I18nProvider';
import { ROW_PX, pxFromMin, toMin, absMin, topPxAt, DEFAULT_FIRST_HOUR, DEFAULT_LAST_HOUR } from '../fixtures';
import type { Appointment, DayKey, WeekDay } from '../types';

/**
 * Détecte si un RDV est en retard : statut confirmed (PLANIFIE/CONFIRME) ET
 * créneau passé sans qu'on ait enregistré d'arrivée. Le now passé en argument
 * permet de tester de façon déterministe.
 *
 * Seuil : start + 5 min de grâce. Au-delà, le RDV est marqué en retard
 * (bordure corail), même si la durée du créneau n'est pas encore écoulée —
 * la sémantique « en retard » est « passé l'heure d'arrivée attendue », pas
 * « passé la fin de consultation ».
 */
function isLate(a: Appointment, dayKey: DayKey, todayKey: DayKey | undefined, nowMin: number): boolean {
  if (a.status !== 'confirmed') return false;
  if (dayKey !== todayKey) return false;
  const GRACE = 5;
  return toMin(a.start) + GRACE < nowMin;
}

/**
 * Layout en colonnes pour gérer les chevauchements (style Google Calendar) :
 * regroupe les RDV qui se croisent en clusters, puis assigne à chacun un
 * indice de colonne. Le rendu utilise ces indices pour calculer left/width
 * et afficher les RDV côte-à-côte au lieu de les empiler.
 */
function assignColumns(items: Appointment[]): Map<number, { col: number; cols: number }> {
  // Tri par start, puis par durée décroissante pour favoriser les blocs longs en col 0.
  const sorted = [...items].map((a, idx) => ({ ...a, _idx: idx, _start: toMin(a.start), _end: toMin(a.start) + a.dur }))
    .sort((a, b) => a._start - b._start || b.dur - a.dur);

  const result = new Map<number, { col: number; cols: number }>();
  let cluster: typeof sorted = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    // Algorithme greedy : pour chaque item, prend la plus petite colonne libre.
    const colEnds: number[] = []; // colEnds[c] = fin du dernier item posé dans la col c
    const itemCols: number[] = [];
    for (const it of cluster) {
      let placed = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if ((colEnds[c] ?? 0) <= it._start) { placed = c; break; }
      }
      if (placed === -1) { placed = colEnds.length; colEnds.push(0); }
      colEnds[placed] = it._end;
      itemCols.push(placed);
    }
    const cols = colEnds.length;
    cluster.forEach((it, i) => {
      result.set(it._idx, { col: itemCols[i] ?? 0, cols });
    });
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    if (cluster.length === 0 || it._start < clusterEnd) {
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it._end);
    } else {
      flush();
      cluster.push(it);
      clusterEnd = it._end;
    }
  }
  flush();
  return result;
}

interface AgendaGridProps {
  days: WeekDay[];
  appointments: Appointment[];
  onSelect?: (a: Appointment) => void;
  /** Click on an empty area of a day column → "HH:MM" snapped to 5 min. */
  onSlotClick?: (dayKey: DayKey, time: string) => void;
  /** Drop a dragged appointment block on a day column → new (day, "HH:MM"). */
  onMove?: (appointmentId: string, dayKey: DayKey, time: string) => void;
  /** Day key of "today" — used to render the current-time line. */
  today?: DayKey;
  /** "HH:MM" — used to position the now-line. */
  now?: string;
  /** Days that fall in a practitioner-leave range. Painted with a striped overlay. */
  leaveDays?: Set<DayKey>;
  /** R053 — mapping reasonId → colorHex pour teinter chaque bloc selon son motif. */
  reasonColors?: Record<string, string>;
  /**
   * Jour view mode (one day, full-width). Per design-handoff-v2 / `screens/
   * agenda.jsx::AgendaJour`, the single header cell carries the `today` class
   * (gradient highlight regardless of the actual current day) and gets a
   * right-aligned "X RDV programmés" suffix.
   */
  jourMode?: boolean;
  /**
   * Multi-doctor split (iso batch3 maquette : `careplus refresh - batch 3.html`
   * day view) : quand on est en `jourMode` et qu'on a sélectionné « Tous les
   * médecins », on rend N colonnes (une par médecin actif) à la place d'une
   * seule colonne fusionnée. Chaque colonne ne montre que les RDV de ce
   * médecin pour le jour affiché — la secrétaire voit qui fait quoi d'un
   * coup d'œil.
   *
   * Header de colonne : pastille couleur + nom du médecin + count.
   * Si `doctorLanes` est absent (mode single-praticien ou vue Semaine), on
   * retombe sur le rendu jour-unique standard.
   */
  doctorLanes?: Array<{ id: string; name: string; dotColor?: string }>;
  /**
   * Lookup pour le mini-avatar médecin sur chaque carte RDV (vue Semaine
   * multi-praticien, iso maquette utilisateur 2026-05-28) : pastille colorée
   * avec initiales (ex. « EA » pour El Amrani). Affichée seulement si la
   * carte connaît un practitionerId présent dans la map ET qu'on a ≥ 2
   * médecins actifs (sinon c'est du bruit visuel en mode solo).
   */
  practitionerMap?: Record<string, { initials: string; color: string; name: string }>;
  /**
   * Pause déjeuner par jour. Configurable côté cabinet — un jour peut ne pas
   * en avoir (samedi typique), un autre peut l'avoir à 13-15H. Si le jour
   * affiché n'est pas dans la map, AUCUN bloc pause n'est rendu pour ce jour.
   */
  lunchBreaks?: Partial<Record<DayKey, { start: string; end: string }>>;
}

const SNAP_MIN = 5;
const WEEKEND = new Set<DayKey>(['sam', 'dim']);

/**
 * Fenêtre horaire à afficher : par défaut 08:00–20:00 (libellés 08..19), élargie
 * pour englober tout RDV/pause hors de cette plage. Sans ça, un RDV du soir
 * (≥ 20h) ou tôt le matin (< 8h) était positionné dans le vide sous/au-dessus de
 * l'axe des heures — la grille s'arrêtait à 19h tandis qu'un RDV de 23h50 se
 * retrouvait ~400 px plus bas dans le vide (bug user Image #5).
 */
function computeHourWindow(
  appointments: Appointment[],
  lunchBreaks?: Partial<Record<DayKey, { start: string; end: string }>>,
): { firstHour: number; hours: number[] } {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  for (const a of appointments) {
    const startMin = absMin(a.start);
    const endMin = startMin + a.dur;
    first = Math.min(first, Math.floor(startMin / 60));
    last = Math.max(last, Math.ceil(endMin / 60));
  }
  if (lunchBreaks) {
    for (const lb of Object.values(lunchBreaks)) {
      if (!lb) continue;
      first = Math.min(first, Math.floor(absMin(lb.start) / 60));
      last = Math.max(last, Math.ceil(absMin(lb.end) / 60));
    }
  }
  first = Math.max(0, first);
  last = Math.min(24, last);
  const hours: number[] = [];
  for (let h = first; h < last; h++) hours.push(h);
  return { firstHour: first, hours };
}

/**
 * Pause déjeuner — purement visuel, configurable PAR JOUR (user 2026-05-28 :
 * pas figé pour tous les jours, samedi n'a souvent pas de pause par exemple).
 * Le prop `lunchBreaks` passe une map DayKey → {start, end} ; les jours
 * absents ne rendent aucun bloc. Cette config viendra du backend cabinet
 * settings quand le module sera prêt — pour l'instant, default exporté depuis
 * AgendaPage avec une heuristique Maroc (Lun-Ven 12-14, Sam aucune pause).
 */
function PauseDejBlock({ start, end, firstHour, standalone = false }: { start: string; end: string; firstHour: number; standalone?: boolean }) {
  const { t } = useT();
  const top = topPxAt(start, firstHour);
  const height = pxFromMin(absMin(end) - absMin(start));
  // Libellé "12 – 14H" (extrait des heures), pas un format figé.
  const sH = start.split(':')[0]?.replace(/^0/, '') ?? '12';
  const eH = end.split(':')[0]?.replace(/^0/, '') ?? '14';
  return (
    <div
      className="ag-pause-block"
      style={{ top, height }}
      aria-hidden={standalone ? undefined : 'true'}
      role={standalone ? 'note' : undefined}
    >
      <span className="ag-pause-label">{t('agenda.grid.lunch', { start: sH, end: eH })}</span>
    </div>
  );
}

function snapTimeFromY(yPx: number, totalRows: number, firstHour: number): string {
  const max = totalRows * 60;
  const totalMin = Math.max(0, Math.min(max - SNAP_MIN, (yPx / ROW_PX) * 60));
  const snapped = Math.round(totalMin / SNAP_MIN) * SNAP_MIN;
  const h = firstHour + Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function AgendaGrid({ days, appointments, onSelect, onSlotClick, onMove, today, now, leaveDays, jourMode = false, reasonColors, doctorLanes, practitionerMap, lunchBreaks }: AgendaGridProps) {
  const { t } = useT();
  // Default `now` to the actual wall-clock when the page didn't pass one.
  // Hardcoding "09:47" (the design fixture) used to leak into production —
  // today = Sunday at 22h showed a phantom line at 09:47 on Thursday.
  const effectiveNow = now ?? (() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  })();
  // Fenêtre horaire dynamique : on ne regarde que les RDV des jours réellement
  // affichés (un RDV tardif de mardi ne doit pas étirer une vue Jour=lundi).
  const dayKeySet = new Set(days.map((d) => d.key));
  const shownAppointments = appointments.filter((a) => dayKeySet.has(a.day));
  const { firstHour, hours } = computeHourWindow(shownAppointments, lunchBreaks);
  const nowTop = topPxAt(effectiveNow, firstHour);
  // Multi-doctor lane mode : 1 jour affiché + N médecins → N colonnes.
  // Sinon, mode standard : 1 colonne par jour (jour ou semaine).
  const multiDoctor = jourMode && doctorLanes && doctorLanes.length > 0 && days.length === 1;
  const trackCount = multiDoctor ? doctorLanes!.length : days.length;
  const colTemplate = `56px repeat(${Math.max(1, trackCount)}, 1fr)`;
  return (
    <div className="ag-grid-wrap">
      <div className="ag-header" style={{ gridTemplateColumns: colTemplate }}>
        <div className="ag-header-cell" />
        {multiDoctor
          ? doctorLanes!.map((lane) => {
              const count = appointments.filter((a) => a.day === days[0]!.key && a.practitionerId === lane.id).length;
              return (
                <div key={lane.id} className="ag-header-cell ag-lane-header today">
                  {lane.dotColor && <span className="ag-lane-dot" style={{ background: lane.dotColor }} />}
                  <span className="ag-lane-name">{lane.name}</span>
                  <span className="ag-day-count">{t('agenda.grid.rdvCount', { n: count })}</span>
                </div>
              );
            })
          : days.map((d) => {
              const isHighlighted = jourMode || d.key === today;
              const dayItemCount = appointments.filter((a) => a.day === d.key).length;
              return (
                <div key={d.key} className={`ag-header-cell ${isHighlighted ? 'today' : (WEEKEND.has(d.key) ? 'wk' : '')}`}>
                  <span className="d-lbl">{d.label}</span>
                  <span className="d-num">{d.date}</span>
                  {jourMode && (
                    <span className="ag-day-count">{t('agenda.grid.rdvScheduled', { n: dayItemCount })}</span>
                  )}
                </div>
              );
            })}
      </div>
      <div className="ag-scroll scroll">
        <div className="ag-grid" style={{ height: hours.length * ROW_PX, gridTemplateColumns: colTemplate }}>
          <div className="ag-hourcol">
            {hours.map((h) => (
              <div key={h} className="ag-hour-label tnum">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {multiDoctor
            ? doctorLanes!.map((lane) => {
                const dKey = days[0]!.key;
                const laneApts = appointments.filter((a) => a.day === dKey && a.practitionerId === lane.id);
                const colInfo = assignColumns(laneApts);
                const nowMinNum = toMin(effectiveNow);
                return (
                  <div
                    key={lane.id}
                    className={[
                      'ag-daycol',
                      'ag-lane',
                      'today',
                      onSlotClick ? 'clickable' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={(e) => {
                      if (!onSlotClick) return;
                      if ((e.target as HTMLElement).closest('.ag-block')) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const time = snapTimeFromY(e.clientY - rect.top, hours.length, firstHour);
                      onSlotClick(dKey, time);
                    }}
                  >
                    {hours.map((h) => (<div key={h} className="ag-hour-cell" />))}
                    {lunchBreaks?.[dKey] && (
                      <PauseDejBlock
                        start={lunchBreaks[dKey]!.start}
                        end={lunchBreaks[dKey]!.end}
                        firstHour={firstHour}
                      />
                    )}
                    {today && dKey === today && (
                      <div className="ag-now" style={{ top: nowTop }} aria-label={t('agenda.grid.nowAria', { time: effectiveNow })}>
                        <span className="ag-now-lbl tnum">{effectiveNow}</span>
                      </div>
                    )}
                    {laneApts.map((a, i) => {
                      const color = a.reasonId ? reasonColors?.[a.reasonId] : undefined;
                      const late = isLate(a, dKey, today, nowMinNum);
                      const info = colInfo.get(i) ?? { col: 0, cols: 1 };
                      const pid = a.practitionerId;
                      const pract = pid ? practitionerMap?.[pid] : undefined;
                      return (
                        <AgendaBlock
                          key={`${lane.id}-${i}`}
                          a={a}
                          firstHour={firstHour}
                          {...(onSelect ? { onClick: onSelect } : {})}
                          draggable={!!onMove}
                          {...(color ? { reasonColor: color } : {})}
                          late={late}
                          colIndex={info.col}
                          colCount={info.cols}
                          {...(pract ? { practitioner: pract } : {})}
                        />
                      );
                    })}
                  </div>
                );
              })
            : days.map((d) => {
            const dayApts = appointments.filter((a) => a.day === d.key);
            const colInfo = assignColumns(dayApts);
            const nowMinNum = toMin(effectiveNow);
            return (
            <div
              key={d.key}
              className={[
                'ag-daycol',
                jourMode || d.key === today ? 'today' : (WEEKEND.has(d.key) ? 'wk' : ''),
                leaveDays?.has(d.key) ? 'leave' : '',
                onSlotClick ? 'clickable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(e) => {
                if (!onSlotClick) return;
                // Ignore clicks that bubbled from an existing appointment block.
                if ((e.target as HTMLElement).closest('.ag-block')) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const time = snapTimeFromY(e.clientY - rect.top, hours.length, firstHour);
                onSlotClick(d.key, time);
              }}
              onDragOver={(e) => {
                if (!onMove) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                if (!onMove) return;
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (!id) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const time = snapTimeFromY(e.clientY - rect.top, hours.length, firstHour);
                onMove(id, d.key, time);
              }}
            >
              {hours.map((h) => (
                <div key={h} className="ag-hour-cell" />
              ))}
              {lunchBreaks?.[d.key] && (
                <PauseDejBlock
                  start={lunchBreaks[d.key]!.start}
                  end={lunchBreaks[d.key]!.end}
                  firstHour={firstHour}
                  standalone={days.length === 1}
                />
              )}
              {today && d.key === today && (
                <div className="ag-now" style={{ top: nowTop }} aria-label={t('agenda.grid.nowAria', { time: effectiveNow })}>
                  <span className="ag-now-lbl tnum">{effectiveNow}</span>
                </div>
              )}
              {dayApts.map((a, i) => {
                  const color = a.reasonId ? reasonColors?.[a.reasonId] : undefined;
                  const late = isLate(a, d.key, today, nowMinNum);
                  const info = colInfo.get(i) ?? { col: 0, cols: 1 };
                  const pid = a.practitionerId;
                  const pract = pid ? practitionerMap?.[pid] : undefined;
                  return (
                    <AgendaBlock
                      key={`${d.key}-${i}`}
                      a={a}
                      firstHour={firstHour}
                      {...(onSelect ? { onClick: onSelect } : {})}
                      draggable={!!onMove}
                      {...(color ? { reasonColor: color } : {})}
                      late={late}
                      colIndex={info.col}
                      colCount={info.cols}
                      {...(pract ? { practitioner: pract } : {})}
                    />
                  );
                })}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
