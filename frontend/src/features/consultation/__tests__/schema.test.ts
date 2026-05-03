/**
 * Pin the wording of the sign-time validation messages.
 *
 * Pourquoi : un praticien (Youssef Boutaleb, 2026-05-01) a interprété
 * « Analyse requise » comme « il faut prescrire une analyse biologique
 * pour pouvoir signer ». Le champ est en réalité le « A » du SOAP
 * (Appréciation / diagnostic). Les messages doivent être explicites pour
 * qu'aucun médecin ne pense devoir prescrire une analyse pour signer.
 *
 * Ces tests échouent dès que quelqu'un retombe sur des libellés ambigus
 * (« Analyse requise », « Subjectif requis » sans contexte SOAP).
 */
import { describe, expect, it } from 'vitest';
import { consultationSignSchema } from '../schema';

describe('consultationSignSchema — wording', () => {
  it('rejette explicitement le « A » du SOAP comme Appréciation, pas comme analyse biologique', () => {
    const result = consultationSignSchema.safeParse({
      subjectif: 'x', objectif: 'x', analyse: '', plan: 'x',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const msg = result.error.issues.find(i => i.path[0] === 'analyse')?.message ?? '';
    expect(msg).not.toMatch(/^Analyse requise$/i);
    expect(msg.toLowerCase()).toMatch(/appréciation|diagnostic|soap/);
  });

  it('mentionne « SOAP » ou la lettre dans chaque message pour lever l\'ambiguïté', () => {
    const result = consultationSignSchema.safeParse({
      subjectif: '', objectif: '', analyse: '', plan: '',
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    for (const issue of result.error.issues) {
      expect(issue.message.toLowerCase()).toMatch(/soap|\([sopa]\)|appréciation/);
    }
  });

  it('autorise la signature dès que les 4 sections sont renseignées', () => {
    const result = consultationSignSchema.safeParse({
      subjectif: 'plainte', objectif: 'examen', analyse: 'dx', plan: 'plan',
    });
    expect(result.success).toBe(true);
  });
});
