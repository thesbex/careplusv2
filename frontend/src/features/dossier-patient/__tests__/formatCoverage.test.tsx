/**
 * V044/coverage-fix — formatCoverage helper.
 *
 * Pre-fix, the patient header rendered a hard-coded "—" for insurance even
 * when a mutuelle was on file (user report 2026-05-17). This test pins the
 * three branches: no mutuelle, mutuelle without policy number, full coverage.
 */
import { describe, it, expect } from 'vitest';
import { formatCoverage } from '../components/PatientHeader';

const INSURANCES = [
  { id: 'ins-1', name: 'AMO CNOPS' },
  { id: 'ins-2', name: 'Wafa Assurance' },
];

describe('formatCoverage', () => {
  it('returns "Aucune mutuelle" when no insurance is set', () => {
    expect(
      formatCoverage(
        { mutuelleInsuranceId: null, mutuellePolicyNumber: null },
        INSURANCES,
      ),
    ).toBe('Aucune mutuelle');
  });

  it('returns just the insurance name when policy number is missing', () => {
    expect(
      formatCoverage(
        { mutuelleInsuranceId: 'ins-1', mutuellePolicyNumber: null },
        INSURANCES,
      ),
    ).toBe('AMO CNOPS');
  });

  it('returns "<name> · N° <policy>" when both fields are set', () => {
    expect(
      formatCoverage(
        { mutuelleInsuranceId: 'ins-2', mutuellePolicyNumber: 'POL-12345' },
        INSURANCES,
      ),
    ).toBe('Wafa Assurance · N° POL-12345');
  });

  it('falls back to "Mutuelle" when the id is unknown (stale catalog)', () => {
    expect(
      formatCoverage(
        { mutuelleInsuranceId: 'ghost-id', mutuellePolicyNumber: 'POL-9' },
        INSURANCES,
      ),
    ).toBe('Mutuelle · N° POL-9');
  });
});
