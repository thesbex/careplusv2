/**
 * QA9-13 — Consentements éclairés.
 *
 * Contrat backend (déjà déployé, base axios = /api) :
 *   GET    /api/consent-templates                  → ConsentTemplateView[] (MEDECIN actifs / ADMIN tous)
 *   POST   /api/consent-templates                  → 201 view (ADMIN)
 *   PUT    /api/consent-templates/{id}             → 200 view (ADMIN)
 *   DELETE /api/consent-templates/{id}             → 204 soft-delete (ADMIN)
 *   POST   /api/patients/{patientId}/consents      → 201 { documentId } (MEDECIN + ADMIN)
 *   GET    /api/patients/{patientId}/consents      → documents CONSENTEMENT du patient
 */

export type ConsentType =
  | 'PARTAGE_DOSSIER'
  | 'ACTE_OPERATOIRE'
  | 'ANESTHESIE'
  | 'IMAGERIE'
  | 'PRELEVEMENT'
  | 'HOSPITALISATION'
  | 'AUTRE';

export interface ConsentTemplateView {
  id: string;
  type: ConsentType;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentTemplateWriteRequest {
  type: ConsentType;
  title: string;
  body: string;
  active: boolean;
}

export interface ConsentGenerateRequest {
  templateId?: string;
  title: string;
  body: string;
}

export interface ConsentGenerateResponse {
  documentId: string;
}

export const CONSENT_TYPE_LABELS: Record<ConsentType, string> = {
  PARTAGE_DOSSIER: 'Partage du dossier',
  ACTE_OPERATOIRE: 'Acte opératoire',
  ANESTHESIE: 'Anesthésie',
  IMAGERIE: 'Imagerie',
  PRELEVEMENT: 'Prélèvement',
  HOSPITALISATION: 'Hospitalisation',
  AUTRE: 'Autre',
};

export const CONSENT_TYPE_ORDER: ConsentType[] = [
  'PARTAGE_DOSSIER',
  'ACTE_OPERATOIRE',
  'ANESTHESIE',
  'IMAGERIE',
  'PRELEVEMENT',
  'HOSPITALISATION',
  'AUTRE',
];

/**
 * Placeholders supportés côté backend lors de la génération PDF. Affiché
 * comme aide au moment de la rédaction d'un modèle / d'un consentement.
 */
export const CONSENT_PLACEHOLDERS = ['{{patientNom}}', '{{patientCin}}', '{{dateJour}}', '{{cabinet}}'] as const;
