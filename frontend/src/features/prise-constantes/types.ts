/**
 * Local types for the Prise des constantes screen (screen 05).
 * Derived from the prototype fixture shapes in:
 *   design/prototype/screens/prise-constantes.jsx
 *   design/prototype/mobile/screens.jsx (MConstantes block)
 */
import type { VitalsFormValues } from './schema';

export type { VitalsFormValues };

/**
 * A single vital entry shown inside the VitalFieldLarge card.
 * The "warn" flag turns the card amber when the value is outside
 * the reference range.
 */
export interface VitalFieldConfig {
  /** Field key in VitalsFormValues. */
  fieldKey: keyof VitalsFormValues;
  /** Display label (French). */
  label: string;
  /** Icon name from @/components/icons. */
  icon: 'Heart' | 'Thermo' | 'Dot' | 'Signal';
  /** Unit suffix shown after the input. */
  unit: string;
  /** Initial / placeholder value string. */
  placeholder: string;
  /** Human-readable range status shown below the input. */
  norm: string;
  /** When true the card renders with amber border + bg. */
  warn?: boolean;
}

/** One vital reading in the "last visit" reference card. */
export interface PreviousVitalEntry {
  label: string;
  value: string;
  unit: string;
}

/** Shape returned by useRecordVitals. */
export interface UseRecordVitalsResult {
  submit: (values: VitalsFormValues) => Promise<void>;
  isPending: boolean;
  isSuccess: boolean;
  error: string | null;
}
