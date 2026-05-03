/**
 * E2E spec 3 of 3 — Invoice lifecycle.
 *
 * Once a consultation is signed, the BillingService listener auto-creates a
 * BROUILLON invoice (event-driven, AFTER_COMMIT). This spec walks the
 * remaining lifecycle: brouillon → issue (sequential number YYYY-NNNNNN) →
 * partial payment → final payment → PAYEE_TOTALE.
 */
import { expect, request, test } from '@playwright/test';
import { apiLogin, authedApi, USERS } from './helpers';

test.describe('Invoice lifecycle', () => {
  test('sign → draft → issue → pay → PAYEE_TOTALE', async () => {
    const ctx = await request.newContext();
    const sec = await apiLogin(ctx, USERS.secretaire.email, USERS.secretaire.password);
    const med = await apiLogin(ctx, USERS.medecin.email, USERS.medecin.password);

    const apiSec = await authedApi(sec.accessToken);
    const apiMed = await authedApi(med.accessToken);

    // Same setup as consultation-flow: book, check-in, vitals, start, sign.
    const patients = await apiSec
      .get('/patients?size=1')
      .then((r) => r.json() as Promise<{ content: { id: string }[] }>);
    const patientId = patients.content[0]!.id;

    const reasons = await apiSec
      .get('/reasons')
      .then((r) => r.json() as Promise<{ id: string; durationMinutes: number }[]>);
    const reason = reasons[0]!;

    const start = new Date();
    start.setMinutes(start.getMinutes() - 5, 0, 0);
    const apt = await apiSec
      .post('/appointments', {
        data: {
          patientId,
          practitionerId: med.user.id,
          startAt: start.toISOString(),
          durationMinutes: reason.durationMinutes,
          reasonId: reason.id,
        },
      })
      .then((r) => r.json() as Promise<{ id: string }>);
    await apiSec.post(`/appointments/${apt.id}/check-in`);
    await apiMed.post(`/appointments/${apt.id}/vitals`, {
      data: {
        systolicMmhg: 120,
        diastolicMmhg: 80,
        heartRateBpm: 72,
        spo2Percent: 98,
        temperatureC: 37,
        weightKg: 75,
        heightCm: 175,
      },
    });
    const consultation = await apiMed
      .post('/consultations', { data: { patientId, appointmentId: apt.id } })
      .then((r) => r.json() as Promise<{ id: string }>);
    await apiMed.put(`/consultations/${consultation.id}`, {
      data: { motif: 'visite simple', examination: 'rien', diagnosis: 'sain', notes: '-' },
    });
    await apiMed.post(`/consultations/${consultation.id}/sign`);

    // Wait briefly for the AFTER_COMMIT event to spawn the draft invoice.
    let draft: { id: string; status: string; netAmount: number } | null = null;
    for (let i = 0; i < 20 && !draft; i++) {
      const r = await apiSec.get(`/consultations/${consultation.id}/invoice`);
      if (r.status() === 200) {
        draft = (await r.json()) as { id: string; status: string; netAmount: number };
      } else {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    expect(draft).not.toBeNull();
    expect(draft!.status).toBe('BROUILLON');

    // Issue.
    const issued = await apiSec
      .post(`/invoices/${draft!.id}/issue`)
      .then((r) => r.json() as Promise<{ number: string }>);
    expect(issued.number).toMatch(/^\d{4}-\d{6}$/);

    // Pay half.
    const half = Math.round((draft!.netAmount / 2) * 100) / 100;
    const partial = await apiSec.post(`/invoices/${draft!.id}/payments`, {
      data: { amount: half, mode: 'ESPECES', reference: null, paidAt: null },
    });
    expect([200, 201]).toContain(partial.status());

    let after = await apiSec
      .get(`/invoices/${draft!.id}`)
      .then((r) => r.json() as Promise<{ status: string }>);
    expect(after.status).toBe('PAYEE_PARTIELLE');

    // Pay the rest.
    const remaining = Math.round((draft!.netAmount - half) * 100) / 100;
    await apiSec.post(`/invoices/${draft!.id}/payments`, {
      data: { amount: remaining, mode: 'CB', reference: 'TXN-1234', paidAt: null },
    });
    after = await apiSec
      .get(`/invoices/${draft!.id}`)
      .then((r) => r.json() as Promise<{ status: string }>);
    expect(after.status).toBe('PAYEE_TOTALE');
  });
});
