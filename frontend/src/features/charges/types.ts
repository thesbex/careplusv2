/**
 * QA9-15 — Charges du cabinet (dépenses).
 * Contrat backend (déjà déployé) :
 *   GET    /api/expenses?category=&from=&to=   → ExpenseResponse[] (MEDECIN+ADMIN)
 *   POST   /api/expenses                        → 201 (ADMIN)
 *   PUT    /api/expenses/{id}                    → 200 (ADMIN)
 *   DELETE /api/expenses/{id}                    → 204 soft-delete (ADMIN)
 *   GET    /api/expenses/summary?year=YYYY       → { month, total }[] (MEDECIN+ADMIN)
 */

export type ExpenseCategory =
  | 'EAU_ELECTRICITE'
  | 'INTERNET'
  | 'LOYER'
  | 'SYNDIC'
  | 'REPARATION'
  | 'FOURNITURES'
  | 'ASSURANCE'
  | 'IMPOTS'
  | 'SALAIRE'
  | 'AUTRE';

export type ExpensePeriodicity = 'PONCTUELLE' | 'MENSUELLE' | 'ANNUELLE';

export interface ExpenseResponse {
  id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  /** YYYY-MM-DD */
  expenseDate: string;
  periodicity: ExpensePeriodicity;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** MANUAL = charge saisie ; HR = paiement de salaire agrégé (lecture seule). */
  source: 'MANUAL' | 'HR';
}

export interface ExpenseRequest {
  category: ExpenseCategory;
  label: string;
  amount: number;
  /** YYYY-MM-DD */
  expenseDate: string;
  periodicity: ExpensePeriodicity;
  supplier?: string;
  notes?: string;
}

export interface ExpenseFilters {
  category?: ExpenseCategory | '';
  from?: string;
  to?: string;
}

export interface MonthlyTotal {
  /** 1-12 */
  month: number;
  total: number;
}

/**
 * i18n (#122) : les libellés FR des catégories / périodicités / mois vivent
 * désormais dans messages.charges.ts (clés `charges.cat.*`, `charges.per.*`,
 * `charges.month.*`) et sont résolus via `t()` dans les composants. On ne
 * conserve ici que l'ordre d'affichage (codes), indépendant de la langue.
 */
export const CATEGORY_ORDER: ExpenseCategory[] = [
  'EAU_ELECTRICITE',
  'INTERNET',
  'LOYER',
  'SYNDIC',
  'REPARATION',
  'FOURNITURES',
  'ASSURANCE',
  'IMPOTS',
  'SALAIRE',
  'AUTRE',
];

export const PERIODICITY_ORDER: ExpensePeriodicity[] = ['PONCTUELLE', 'MENSUELLE', 'ANNUELLE'];

/** Format MAD comme le reste de l'app (FacturationPage / InvoiceDrawer). */
export function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}
