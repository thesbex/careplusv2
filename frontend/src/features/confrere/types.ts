/**
 * QA9-10 — Courrier au confrère.
 *
 * Contrat backend (déjà déployé, base axios = /api) :
 *   POST /api/consultations/{consultationId}/confrere-letter  (MEDECIN + ADMIN)
 *        body { recipientName: string (requis), recipientSpecialty?: string,
 *               recipientCity?: string, body: string (requis) }
 *        → 201 { documentId }
 *   GET  /api/consultations/{consultationId}/confrere-letters
 *        → documents (type LETTRE_CONFRERE) de cette consultation
 */

export interface ConfrereLetterRequest {
  recipientName: string;
  recipientSpecialty?: string;
  recipientCity?: string;
  body: string;
}

export interface ConfrereLetterResponse {
  documentId: string;
}

/**
 * Vue d'un document LETTRE_CONFRERE rattaché à la consultation. Souple :
 * le backend renvoie une liste de documents patient ; on consomme l'id, le
 * titre et la date pour l'affichage. Champs optionnels pour tolérer la forme
 * exacte renvoyée par le module document.
 */
export interface ConfrereLetterDocument {
  id: string;
  title?: string;
  fileName?: string;
  createdAt?: string;
}
