/**
 * Per-doctor grouping of the waiting-room queue (QA9-11).
 *
 * The /queue endpoint is already cloisonnement-filtered server-side, so a
 * cloisonné MEDECIN only receives their own entries and simply ends up with a
 * single column. No extra client-side filtering is required here.
 */
import type { PractitionerView } from '@/features/agenda/hooks/usePractitioners';
import type { QueueEntry } from './types';

export interface QueueColumn {
  /** Practitioner id, or `null` for the "Non affecté" bucket. */
  practitionerId: string | null;
  /** Display label, e.g. "Dr Alami" or "Non affecté". */
  label: string;
  entries: QueueEntry[];
}

const UNASSIGNED = '__unassigned__';

/**
 * Build one column per practitioner that is either active OR has entries, plus
 * an "Non affecté" column when some entries carry no practitionerId.
 * Active practitioners are listed first (in roster order), then any extra
 * practitioner that only shows up via queue entries, then the unassigned bucket.
 */
export function groupQueueByPractitioner(
  queue: QueueEntry[],
  activePractitioners: PractitionerView[],
): QueueColumn[] {
  const byId = new Map<string, QueueEntry[]>();
  let unassigned: QueueEntry[] = [];

  for (const entry of queue) {
    const pid = entry.practitionerId ?? null;
    if (pid === null) {
      unassigned = [...unassigned, entry];
    } else {
      byId.set(pid, [...(byId.get(pid) ?? []), entry]);
    }
  }

  const columns: QueueColumn[] = [];
  const seen = new Set<string>();

  const labelFor = (p: PractitionerView): string =>
    `Dr ${p.lastName}`.trim() || `Dr ${p.firstName}`.trim();

  // 1. Active practitioners in roster order.
  for (const p of activePractitioners) {
    seen.add(p.id);
    columns.push({
      practitionerId: p.id,
      label: labelFor(p),
      entries: byId.get(p.id) ?? [],
    });
  }

  // 2. Practitioners that only appear via queue entries (e.g. inactive but
  //    still have a patient mid-flow). Fall back to the entry's name.
  for (const [pid, entries] of byId) {
    if (seen.has(pid)) continue;
    const name = entries[0]?.practitionerName ?? 'Médecin';
    columns.push({ practitionerId: pid, label: name, entries });
  }

  // 3. Unassigned bucket last, only when non-empty.
  if (unassigned.length > 0) {
    columns.push({ practitionerId: null, label: 'Non affecté', entries: unassigned });
  }

  return columns;
}

export { UNASSIGNED };
