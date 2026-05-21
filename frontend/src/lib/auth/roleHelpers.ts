/**
 * Helpers de discrimination des rôles pour le cloisonnement RBAC.
 *
 * Le cas qui motive ce fichier (retour terrain) : un technicien LAB ou RADIO
 * voyait toute la sidebar (agenda, patients, salle, facturation…) alors qu'il
 * ne devait avoir accès qu'à sa propre queue de traitement interne. Le
 * concept "pure-tech" = un utilisateur dont tous les rôles sont strictement
 * dans {LAB, RADIO}. On cloisonne UI + redirect post-login.
 */

const TECH_ROLES = new Set(['LAB', 'RADIO']);

/**
 * True si le user n'a QUE des rôles techniciens (LAB et/ou RADIO).
 * Un médecin avec un rôle LAB additionnel (cabinet solo qui fait ses analyses)
 * n'est PAS "pure-tech" — il garde l'accès complet.
 */
export function isPureTech(roles: readonly string[] | undefined | null): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.every((r) => TECH_ROLES.has(r));
}

/**
 * Page d'atterrissage par défaut quand un user pure-tech se connecte ou
 * tente d'accéder à une page hors-scope.
 */
export function defaultLandingForTech(roles: readonly string[] | undefined | null): string {
  if (!roles) return '/agenda';
  if (roles.includes('RADIO')) return '/queue/radio';
  if (roles.includes('LAB')) return '/queue/lab';
  return '/agenda';
}
