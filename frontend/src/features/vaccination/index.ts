// ── Hooks ────────────────────────────────────────────────────────────────────
export { useVaccinationCalendar } from './hooks/useVaccinationCalendar';
export { useVaccinationCatalog } from './hooks/useVaccinationCatalog';
export { useRecordDose } from './hooks/useRecordDose';
export { useDeferDose } from './hooks/useDeferDose';
export { useSkipDose } from './hooks/useSkipDose';
export { useUpdateDose } from './hooks/useUpdateDose';
export { useDeleteDose } from './hooks/useDeleteDose';
export { useDownloadBooklet } from './hooks/useDownloadBooklet';

// ── Components ───────────────────────────────────────────────────────────────
export { DoseCard } from './components/DoseCard';
export { VaccinationCalendarTab } from './components/VaccinationCalendarTab';
export { VaccinationCalendarTabMobile } from './components/VaccinationCalendarTab.mobile';
export { RecordDoseDrawer } from './components/RecordDoseDrawer';
export { RecordDoseDrawerMobile } from './components/RecordDoseDrawer.mobile';

// ── Types & schemas ──────────────────────────────────────────────────────────
export type {
  VaccinationCalendarEntry,
  VaccineCatalogEntry,
  RecordDoseRequest,
  DeferDoseRequest,
  UpdateDoseRequest,
  DoseStatus,
  RouteAdmin,
  AgeGroup,
  DrawerMode,
} from './types';
export { AGE_GROUP_LABEL, SITE_SUGGESTIONS } from './types';

export { RecordDoseSchema, DeferDoseSchema, UpdateDoseSchema } from './schemas';
export type { RecordDoseValues, DeferDoseValues, UpdateDoseValues } from './schemas';
