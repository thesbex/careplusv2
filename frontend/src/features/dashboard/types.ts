/**
 * Types miroirs des DTO renvoyés par les 3 contrôleurs Dashboard backend :
 *   GET /api/dashboard/clinical    (MEDECIN, ADMIN)
 *   GET /api/dashboard/agenda      (tous rôles authentifiés)
 *   GET /api/dashboard/financial   (MEDECIN, ADMIN)
 *
 * Aligne strictement le contrat des trois agents BE qui produisent
 * `ClinicalDashboardController`, `AgendaDashboardController` et
 * `FinancialDashboardController`. Toute évolution doit rester en parité avec
 * les `*View` Java (records).
 */

export interface TopPathologyEntry {
  /** Code CIM-10 ou code interne. */
  code: string;
  /** Libellé humain (ex. "Hypertension artérielle"). */
  label: string;
  /** Nombre de patients concernés sur la période. */
  count: number;
}

export interface ActivityPoint {
  /** Date locale ISO (yyyy-MM-dd). */
  date: string;
  /** Nombre de consultations ce jour-là. */
  count: number;
}

export interface ClinicalDashboardView {
  patientsActifsTotal: number;
  patientsActifs30j: number;
  consultationsAujourdhui: number;
  consultationsSemaine: number;
  consultationsMois: number;
  /** Âge moyen en années (peut être 0 si aucun patient). */
  ageMoyenPatientele: number;
  topPathologies: TopPathologyEntry[];
  activite7j: ActivityPoint[];
  activite30j: ActivityPoint[];
}

export interface HourlyLoadPoint {
  /** Heure locale ISO partielle (ex. "08:00", "08:30") ou ISO complète selon BE. */
  slotStart: string;
  count: number;
}

export interface AgendaDashboardView {
  rdvAujourdhui: number;
  rdvSemaine: number;
  /** Ratio 0..1 — créneaux occupés / créneaux disponibles aujourd'hui. */
  tauxRemplissageJour: number;
  /** Ratio 0..1 — créneaux occupés / créneaux disponibles semaine en cours. */
  tauxRemplissageSemaine: number;
  noShowsSemaine: number;
  annulationsSemaine: number;
  nouveauxPatientsMois: number;
  chargeHoraire: HourlyLoadPoint[];
}

export interface MonthlyRevenuePoint {
  /** "yyyy-MM" (ex. "2026-04"). */
  month: string;
  /** Montant en MAD. */
  amount: number;
}

export interface RevenueByActe {
  acteCode: string;
  label: string;
  /** Montant total en MAD pour l'acte sur la période courante. */
  amount: number;
  /** Nombre d'actes facturés sur la période courante. */
  count: number;
}

export interface FinancialDashboardView {
  caJour: number;
  caMois: number;
  caYTD: number;
  /** CA du même mois l'année dernière (pour comparatif YoY). */
  caMoisN1: number;
  ca12Mois: MonthlyRevenuePoint[];
  caParActe: RevenueByActe[];
  impayesTotal: number;
  impayesCount: number;
  /** Ratio 0..1 — encaissé / facturé sur 30 j glissants. */
  tauxEncaissement: number;
}
