/**
 * E2E spec 2 of 3 — Consultation lifecycle.
 *
 * Books → checks-in → records vitals → starts consultation → fills SOAP →
 * creates a drug prescription → signs → downloads ordonnance PDF.
 *
 * Pure-API drive: faster + isolates from UI flakiness. The matching UI
 * screens are independently covered by component tests (vitest).
 */
import { expect, request, test } from '@playwright/test';
import { apiLogin, authedApi, USERS } from './helpers';

test.describe('Consultation lifecycle', () => {
  test('vitals → SOAP → sign → PDF', async () => {
    const ctx = await request.newContext();
    const sec = await apiLogin(ctx, USERS.secretaire.email, USERS.secretaire.password);
    const med = await apiLogin(ctx, USERS.medecin.email, USERS.medecin.password);

    const apiSec = await authedApi(sec.accessToken);
    const apiMed = await authedApi(med.accessToken);

    // Seed: pick a patient + reason, book a slot for now-ish, check-in.
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

    // Vitals.
    const vitals = await apiMed.post(`/appointments/${apt.id}/vitals`, {
      data: {
        systolicMmhg: 130,
        diastolicMmhg: 82,
        heartRateBpm: 76,
        spo2Percent: 98,
        temperatureC: 36.8,
        weightKg: 78,
        heightCm: 178,
      },
    });
    expect([200, 201]).toContain(vitals.status());

    // Start consultation as MEDECIN.
    const consultation = await apiMed
      .post('/consultations', {
        data: { patientId, appointmentId: apt.id, motif: 'Céphalées intermittentes' },
      })
      .then((r) => r.json() as Promise<{ id: string; status: string }>);
    expect(consultation.status).toBe('BROUILLON');

    // Fill SOAP via PUT.
    const updated = await apiMed
      .put(`/consultations/${consultation.id}`, {
        data: {
          motif: 'Céphalées matinales depuis 10 jours',
          examination: 'TA 130/82, auscultation normale, fond d\'œil stade I.',
          diagnosis: 'Hypertension essentielle — contrôle imparfait',
          notes: 'Ajustement Amlodipine 5 → 10 mg. Contrôle à 4 semaines.',
        },
      })
      .then((r) => r.json() as Promise<{ motif: string }>);
    expect(updated.motif).toContain('Céphalées matinales');

    // Create a drug prescription.
    const meds = await apiMed
      .get('/catalog/medications?q=amlodipine')
      .then((r) => r.json() as Promise<{ id: string }[]>);
    expect(meds.length).toBeGreaterThan(0);

    const rx = await apiMed.post(`/consultations/${consultation.id}/prescriptions`, {
      data: {
        type: 'DRUG',
        lines: [
          {
            medicationId: meds[0]!.id,
            dosage: '10 mg',
            frequency: '1 cp matin',
            duration: '30 jours',
            quantity: 30,
            instructions: null,
          },
        ],
        allergyOverride: false,
      },
    });
    expect(rx.status()).toBe(201);
    const rxBody = (await rx.json()) as { id: string };

    // Sign the consultation.
    const signed = await apiMed
      .post(`/consultations/${consultation.id}/sign`)
      .then((r) => r.json() as Promise<{ status: string; signedAt: string }>);
    expect(signed.status).toBe('SIGNEE');
    expect(signed.signedAt).toBeTruthy();

    // Pull the ordonnance PDF.
    const pdf = await apiMed.get(`/prescriptions/${rxBody.id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    const buffer = await pdf.body();
    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
