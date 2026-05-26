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

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  EAU_ELECTRICITE: 'Eau / Électricité',
  INTERNET: 'Internet',
  LOYER: 'Loyer',
  SYNDIC: 'Frais de syndic',
  REPARATION: 'Réparation',
  FOURNITURES: 'Fournitures',
  ASSURANCE: 'Assurance',
  IMPOTS: 'Impôts',
  SALAIRE: 'Salaire',
  AUTRE: 'Autre',
};

export const PERIODICITY_LABELS: Record<ExpensePeriodicity, string> = {
  PONCTUELLE: 'Ponctuelle',
  MENSUELLE: 'Mensuelle',
  ANNUELLE: 'Annuelle',
};

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

export const MONTH_LABELS_SHORT = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

/** Format MAD comme le reste de l'app (FacturationPage / InvoiceDrawer). */
export function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}
