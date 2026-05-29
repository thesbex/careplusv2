/**
 * Liste curée de codes CIM-10 fréquents en médecine générale (Maroc).
 * Volontairement restreinte aux motifs courants (la CIM-10 complète ≈ 70 000 codes
 * n'a pas sa place dans le bundle). Le bouton « CIM-10 » de l'écran consultation
 * recherche dans cette liste et insère « CODE — libellé » dans l'Analyse.
 * Extensible : ajouter des entrées ici au besoin.
 */
export interface Cim10Entry {
  code: string;
  label: string;
}

export const CIM10_CODES: Cim10Entry[] = [
  // Infections respiratoires / ORL
  { code: 'J00', label: 'Rhinopharyngite aiguë (rhume banal)' },
  { code: 'J02.9', label: 'Pharyngite aiguë, sans précision' },
  { code: 'J03.9', label: 'Amygdalite aiguë, sans précision' },
  { code: 'J06.9', label: 'Infection aiguë des voies respiratoires supérieures' },
  { code: 'J11.1', label: 'Grippe, autres manifestations respiratoires' },
  { code: 'J18.9', label: 'Pneumonie, sans précision' },
  { code: 'J20.9', label: 'Bronchite aiguë, sans précision' },
  { code: 'J45.9', label: 'Asthme, sans précision' },
  { code: 'J44.9', label: 'BPCO, sans précision' },
  { code: 'J32.9', label: 'Sinusite chronique, sans précision' },
  { code: 'H66.9', label: 'Otite moyenne, sans précision' },
  // Cardiovasculaire
  { code: 'I10', label: 'Hypertension artérielle essentielle' },
  { code: 'I20.9', label: 'Angine de poitrine, sans précision' },
  { code: 'I25.1', label: 'Cardiopathie ischémique athéroscléreuse' },
  { code: 'I48.9', label: 'Fibrillation et flutter auriculaires' },
  { code: 'I50.9', label: 'Insuffisance cardiaque, sans précision' },
  { code: 'I83.9', label: 'Varices des membres inférieurs' },
  // Métabolique / endocrinien
  { code: 'E11.9', label: 'Diabète sucré de type 2, sans complication' },
  { code: 'E10.9', label: 'Diabète sucré de type 1, sans complication' },
  { code: 'E78.5', label: 'Hyperlipidémie, sans précision' },
  { code: 'E03.9', label: 'Hypothyroïdie, sans précision' },
  { code: 'E05.9', label: 'Hyperthyroïdie (thyrotoxicose)' },
  { code: 'E66.9', label: 'Obésité, sans précision' },
  { code: 'E86', label: 'Déshydratation / déplétion volumique' },
  // Digestif
  { code: 'K21.9', label: 'Reflux gastro-œsophagien sans œsophagite' },
  { code: 'K29.7', label: 'Gastrite, sans précision' },
  { code: 'K30', label: 'Dyspepsie fonctionnelle' },
  { code: 'K52.9', label: 'Gastro-entérite et colite non infectieuses' },
  { code: 'A09', label: 'Diarrhée et gastro-entérite d’origine infectieuse présumée' },
  { code: 'K59.0', label: 'Constipation' },
  { code: 'K58.9', label: 'Syndrome de l’intestin irritable' },
  // Uro-néphro
  { code: 'N39.0', label: 'Infection des voies urinaires, siège non précisé' },
  { code: 'N30.0', label: 'Cystite aiguë' },
  { code: 'N20.0', label: 'Calcul du rein (lithiase rénale)' },
  // Endo / gynéco / grossesse
  { code: 'Z34.9', label: 'Surveillance d’une grossesse normale' },
  { code: 'N95.1', label: 'Troubles de la ménopause' },
  { code: 'N94.6', label: 'Dysménorrhée, sans précision' },
  // Musculo-squelettique
  { code: 'M54.5', label: 'Lombalgie basse' },
  { code: 'M54.2', label: 'Cervicalgie' },
  { code: 'M25.5', label: 'Douleur articulaire' },
  { code: 'M79.7', label: 'Fibromyalgie' },
  { code: 'M17.9', label: 'Gonarthrose, sans précision' },
  { code: 'M81.9', label: 'Ostéoporose, sans précision' },
  { code: 'M06.9', label: 'Polyarthrite rhumatoïde, sans précision' },
  { code: 'M10.9', label: 'Goutte, sans précision' },
  // Neuro / psy
  { code: 'G43.9', label: 'Migraine, sans précision' },
  { code: 'R51', label: 'Céphalée' },
  { code: 'F41.9', label: 'Trouble anxieux, sans précision' },
  { code: 'F32.9', label: 'Épisode dépressif, sans précision' },
  { code: 'F51.0', label: 'Insomnie non organique' },
  { code: 'G40.9', label: 'Épilepsie, sans précision' },
  // Peau
  { code: 'L20.9', label: 'Dermatite atopique, sans précision' },
  { code: 'L23.9', label: 'Dermatite de contact allergique' },
  { code: 'L30.9', label: 'Dermatite, sans précision (eczéma)' },
  { code: 'L40.9', label: 'Psoriasis, sans précision' },
  { code: 'B35.9', label: 'Dermatophytose (mycose), sans précision' },
  // Symptômes / signes généraux
  { code: 'R05', label: 'Toux' },
  { code: 'R10.4', label: 'Douleurs abdominales, autres et non précisées' },
  { code: 'R50.9', label: 'Fièvre, sans précision' },
  { code: 'R53', label: 'Malaise et fatigue (asthénie)' },
  { code: 'R42', label: 'Étourdissements et vertiges' },
  { code: 'D64.9', label: 'Anémie, sans précision' },
  { code: 'R07.4', label: 'Douleur thoracique, sans précision' },
  // Prévention / suivi
  { code: 'Z00.0', label: 'Examen médical général' },
  { code: 'Z23', label: 'Vaccination (recours pour)' },
  { code: 'Z71.3', label: 'Conseil diététique et surveillance' },
];
