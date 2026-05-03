// ── Hooks ────────────────────────────────────────────────────────────────────
export { useVaccinationCalendar } from './hooks/useVaccinationCalendar';
export { useVaccinationCatalog } from './hooks/useVaccinationCatalog';
export { useRecordDose } from './hooks/useRecordDose';
export { useDeferDose } from './hooks/useDeferDose';
export { useSkipDose } from './hooks/useSkipDose';
export { useUpdateDose } from './hooks/useUpdateDose';
export { useDeleteDose } from './hooks/useDeleteDose';
export { useDownloadBooklet } from './hooks/useDownloadBooklet';
export { useVaccinationsQueue } from './hooks/useVaccinationsQueue';
export { useVaccinationOverdueCount } from './hooks/useVaccinationOverdueCount';
export { useVaccinationSchedule } from './hooks/useVaccinationSchedule';
export { useUpsertVaccine } from './hooks/useUpsertVaccine';
export { useDeactivateVaccine } from './hooks/useDeactivateVaccine';
export { useUpsertScheduleDose } from './hooks/useUpsertScheduleDose';
export { useDeleteScheduleDose } from './hooks/useDeleteScheduleDose';

// ── Components ───────────────────────────────────────────────────────────────
export { DoseCard } from './components/DoseCard';
export { VaccinationCalendarTab } from './components/VaccinationCalendarTab';
export { VaccinationCalendarTabMobile } from './components/VaccinationCalendarTab.mobile';
export { RecordDoseDrawer } from './components/RecordDoseDrawer';
export { RecordDoseDrawerMobile } from './components/RecordDoseDrawer.mobile';
export { VaccinationParamTab } from './components/VaccinationParamTab';

// ── Pages ────────────────────────────────────────────────────────────────────
export { default as VaccinationsQueueRoute } from './VaccinationsQueueRoute';

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

export { RecordDoseSchema, DeferDoseSchema, UpdateDoseSchema, UpsertVaccineSchema, UpsertScheduleDoseSchema } from './schemas';
export type { RecordDoseValues, DeferDoseValues, UpdateDoseValues, UpsertVaccineValues, UpsertScheduleDoseValues } from './schemas';
export type { VaccinationsQueueFilters, VaccinationQueueEntry, VaccinationsQueuePage } from './hooks/useVaccinationsQueue';
export type { VaccineScheduleDose } from './hooks/useVaccinationSchedule';
export type { UpsertVaccineBody } from './hooks/useUpsertVaccine';
export type { UpsertScheduleDoseBody } from './hooks/useUpsertScheduleDose';
