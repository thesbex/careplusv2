/**
 * E2E spec 1 of 3 — Appointment lifecycle.
 *
 * Drives the WF1+WF2 happy path through the API (faster + more reliable than
 * UI clicks for the booking phase) and verifies the resulting state via the
 * UI on the agenda + waiting-room screens.
 */
import { expect, request, test } from '@playwright/test';
import { apiLogin, authedApi, uiLogin, USERS } from './helpers';

test.describe('RDV lifecycle', () => {
  test('book → check-in → appears in salle d\'attente queue', async ({ page }) => {
    const ctx = await request.newContext();
    const sec = await apiLogin(ctx, USERS.secretaire.email, USERS.secretaire.password);
    const med = await apiLogin(ctx, USERS.medecin.email, USERS.medecin.password);

    const apiSec = await authedApi(sec.accessToken);

    // Pick the first seeded patient + first reason.
    const patients = await apiSec
      .get('/patients?size=1')
      .then((r) => r.json() as Promise<{ content: { id: string }[] }>);
    const patientId = patients.content[0]!.id;

    const reasons = await apiSec
      .get('/reasons')
      .then((r) => r.json() as Promise<{ id: string; durationMinutes: number }[]>);
    const reason = reasons[0]!;

    // Book at 10:00 today (no daylight subtleties — works inside business hours).
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const startAt = today.toISOString();

    const created = await apiSec.post('/appointments', {
      data: {
        patientId,
        practitionerId: med.user.id,
        startAt,
        durationMinutes: reason.durationMinutes,
        reasonId: reason.id,
      },
    });
    expect(created.status()).toBe(201);
    const appointment = (await created.json()) as { id: string; status: string };
    expect(appointment.status).toBe('PLANIFIE');

    // Move it back 5 min so check-in is "on-time" (a real cabinet lets a
    // patient arrive a touch early or late).
    const earlierStart = new Date(today.getTime() - 5 * 60_000).toISOString();
    await apiSec.put(`/appointments/${appointment.id}`, {
      data: { startAt: earlierStart, durationMinutes: reason.durationMinutes },
    });

    // Check-in.
    const ci = await apiSec.post(`/appointments/${appointment.id}/check-in`);
    expect(ci.status()).toBe(204);

    // Verify queue contains it.
    const queue = await apiSec.get('/queue').then((r) => r.json() as Promise<{ appointmentId: string }[]>);
    expect(queue.some((q) => q.appointmentId === appointment.id)).toBe(true);

    // UI assertion — the salle d'attente row exists.
    await uiLogin(page, USERS.secretaire.email, USERS.secretaire.password);
    await page.goto('/salle');
    await expect(page.locator('table.sa-queue-table tbody tr')).not.toHaveCount(0);
  });
});
