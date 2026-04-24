/**
 * Prise de RDV feature public exports.
 *
 * Desktop: <PriseRDVDialog open={…} onOpenChange={…} />
 *   → Radix Dialog overlay. Import this on the AgendaPage (to be wired by the
 *     orchestrator — not done here per instructions).
 *
 * Mobile: default export PriseRDVMobilePage
 *   → Full-screen form route. Consumable as a React Router route element.
 *   → Route will be wired by the orchestrator at /rdv/new.
 */
export { PriseRDVDialog } from './PriseRDVDialog';
export { default as PriseRDVMobilePage } from './PriseRDVPage.mobile';
export type { PriseRDVDialogProps } from './PriseRDVDialog';
export type { RdvFormValues, ReasonOption, SlotOption, PatientCandidate } from './types';
