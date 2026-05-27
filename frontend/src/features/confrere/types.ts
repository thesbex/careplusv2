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

/**
 * Modèle de courrier confrère (texte type réutilisable), géré par l'ADMIN
 * dans Paramétrage et chargé par le médecin dans la modale « Courrier confrère »
 * pour pré-remplir le corps de la lettre.
 *
 * Contrat backend (base axios = /api) :
 *   GET    /confrere-letter-templates           (MEDECIN actifs / ADMIN tout)
 *   POST   /confrere-letter-templates            (ADMIN)
 *   PUT    /confrere-letter-templates/{id}       (ADMIN)
 *   DELETE /confrere-letter-templates/{id}       (ADMIN, soft-delete)
 */
export interface LetterTemplateView {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LetterTemplateWriteRequest {
  title: string;
  body: string;
  active: boolean;
}
