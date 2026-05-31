/**
 * QA9-14 — Personnel (RH) du cabinet. ADMIN uniquement.
 * Contrat backend (déjà déployé) :
 *   GET    /api/hr/staff?active=&role=         → StaffResponse[]
 *   GET    /api/hr/staff/{id}                   → StaffResponse
 *   POST   /api/hr/staff                        → 201
 *   PUT    /api/hr/staff/{id}                    → 200
 *   DELETE /api/hr/staff/{id}                    → 204 soft-delete
 *   GET    /api/hr/staff/{id}/summary            → StaffSummary
 *   GET    /api/hr/staff/{id}/leave              → LeaveEntryResponse[]
 *   POST   /api/hr/staff/{id}/leave              → 201
 *   DELETE /api/hr/leave/{id}                     → 204
 *   GET    /api/hr/staff/{id}/payments           → SalaryPaymentResponse[]
 *   POST   /api/hr/staff/{id}/payments           → 201
 *   DELETE /api/hr/payments/{id}                  → 204
 */

export type StaffRole =
  | 'SECURITE'
  | 'MENAGE'
  | 'INFIRMIER'
  | 'SECRETAIRE'
  | 'ASSISTANTE'
  | 'TECHNICIEN'
  | 'AUTRE';

export type LeaveType = 'CONGE' | 'ABSENCE' | 'RETARD';

export interface StaffResponse {
  id: string;
  fullName: string;
  role: StaffRole;
  /** YYYY-MM-DD */
  hireDate: string;
  monthlySalary: number | null;
  phone: string | null;
  userId: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffRequest {
  fullName: string;
  role: StaffRole;
  /** YYYY-MM-DD */
  hireDate: string;
  monthlySalary?: number;
  phone?: string;
  userId?: string;
  active?: boolean;
  notes?: string;
}

export interface StaffSummary {
  staffId: string;
  monthsWorked: number;
  accruedLeaveDays: number;
  takenLeaveDays: number;
  leaveBalanceDays: number;
  absencesCount: number;
  latenessCount: number;
}

export interface LeaveEntryResponse {
  id: string;
  staffId: string;
  type: LeaveType;
  /** YYYY-MM-DD */
  startDate: string;
  days: number;
  notes: string | null;
  createdAt: string;
}

export interface LeaveEntryRequest {
  type: LeaveType;
  /** YYYY-MM-DD */
  startDate: string;
  days?: number;
  notes?: string;
}

export interface SalaryPaymentResponse {
  id: string;
  staffId: string;
  /** YYYY-MM */
  period: string;
  amount: number;
  /** YYYY-MM-DD */
  paidAt: string;
  notes: string | null;
  createdAt: string;
}

export interface SalaryPaymentRequest {
  /** YYYY-MM */
  period: string;
  amount: number;
  /** YYYY-MM-DD */
  paidAt: string;
  notes?: string;
}

export interface StaffFilters {
  active?: boolean;
  role?: StaffRole | '';
}

/** Clés i18n des postes (StaffRole) — voir messages.staff.ts (`staff.role.*`). */
export const ROLE_LABEL_KEYS: Record<StaffRole, string> = {
  SECURITE: 'staff.role.SECURITE',
  MENAGE: 'staff.role.MENAGE',
  INFIRMIER: 'staff.role.INFIRMIER',
  SECRETAIRE: 'staff.role.SECRETAIRE',
  ASSISTANTE: 'staff.role.ASSISTANTE',
  TECHNICIEN: 'staff.role.TECHNICIEN',
  AUTRE: 'staff.role.AUTRE',
};

export const ROLE_ORDER: StaffRole[] = [
  'SECRETAIRE',
  'ASSISTANTE',
  'INFIRMIER',
  'TECHNICIEN',
  'SECURITE',
  'MENAGE',
  'AUTRE',
];

/** Clés i18n des types de congé (LeaveType) — voir messages.staff.ts (`staff.leaveType.*`). */
export const LEAVE_TYPE_LABEL_KEYS: Record<LeaveType, string> = {
  CONGE: 'staff.leaveType.CONGE',
  ABSENCE: 'staff.leaveType.ABSENCE',
  RETARD: 'staff.leaveType.RETARD',
};

export const LEAVE_TYPE_ORDER: LeaveType[] = ['CONGE', 'ABSENCE', 'RETARD'];

/** Format MAD comme le reste de l'app (FacturationPage / ChargesPage). */
export function formatMad(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} MAD`;
}

/** Format français "X,X" pour les jours (ex. 1,5). */
export function formatDays(n: number): string {
  return String(n).replace('.', ',');
}
