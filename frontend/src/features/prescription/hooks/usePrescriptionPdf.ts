/**
 * @deprecated Utiliser `useDocumentPdfBlob` ou `useDocumentPdfController`
 * depuis `../components/DocumentPdfViewer`. Ce hook est conservé comme alias
 * pour rétro-compat — il ne supporte que le type "ordonnance" historique
 * (préfixe ORD-, libellé Ordonnance hardcodé). Pour tout nouveau viewer de
 * document (certificat, arrêt de travail, …), passer par `DocumentPdfViewer`
 * qui adapte titre/préfixe/filename selon `prescription.type`.
 */
export { useDocumentPdfBlob as usePrescriptionPdf } from '../components/DocumentPdfViewer';
