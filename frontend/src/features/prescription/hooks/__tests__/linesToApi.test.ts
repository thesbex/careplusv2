/**
 * QA9-7 (suivi .xlsx 2026-05-26) — « fournir en interne » sur une ligne DRUG.
 *
 * Régression : linesToApi() ne propageait le flag `internal` qu'aux lignes
 * LAB/IMAGING, en le forçant à false pour DRUG. La case « Fournir en interne
 * (pharmacie) » du PrescriptionDrawer était donc ignorée → aucune ligne
 * facture créée. Ce test verrouille la propagation du flag pour DRUG (V057)
 * tout en gardant LAB/IMAGING et le défaut non-coché.
 */
import { describe, it, expect } from 'vitest';
import { linesToApi } from '../useCreatePrescription';
import type { PrescriptionLineDraft } from '../../types';

function drugLine(): PrescriptionLineDraft {
  return {
    item: { id: 'med-1', name: 'Doliprane', sub: '1g' },
    dosage: '1 cp', frequency: '3/j', duration: '5 jours', quantity: 2, instructions: '',
  };
}

describe('linesToApi — flag internal', () => {
  it('propage internal=true sur une ligne DRUG quand coché (QA9-7)', () => {
    const out = linesToApi('DRUG', [drugLine()], true);
    expect(out).toHaveLength(1);
    const [line] = out;
    expect(line!.internal).toBe(true);
    expect(line!.medicationId).toBe('med-1');
    expect(line!.quantity).toBe(2);
  });

  it('laisse internal=false sur DRUG quand non coché', () => {
    const [line] = linesToApi('DRUG', [drugLine()], false);
    expect(line!.internal).toBe(false);
  });

  it('propage internal=true sur une ligne LAB (V038, non régressé)', () => {
    const lab: PrescriptionLineDraft = {
      item: { id: 'lab-1', name: 'NFS', sub: null },
      dosage: '', frequency: '', duration: '', quantity: null, instructions: '',
    };
    const [line] = linesToApi('LAB', [lab], true);
    expect(line!.internal).toBe(true);
    expect(line!.labTestId).toBe('lab-1');
  });
});
