/**
 * E2E regression suite for commit dcf15ec — feat(salle-attente): retirer un
 * patient de la liste d'attente.
 *
 * Scenarios covered (desktop Chromium + mobile Pixel 5 unless noted):
 *
 * S1  — Happy path desktop: patient ARRIVE → "Retirer" CTA opens dialog,
 *        motif filled, confirmed → row vanishes from queue, success toast shown,
 *        appointment is ANNULE in DB with cancel_reason persisted.
 * S2  — Happy path mobile: same flow on Pixel 5 viewport — circular "×"
 *        button visible and functional.
 * S3  — Cancel sans motif: reason field left blank → DELETE still succeeds,
 *        appointment transitions to ANNULE, cancelReason is null/empty.
 * S4  — Guard consult status: patient whose frontend status is "consult"
 *        (EN_CONSULTATION) must NOT have a "Retirer" button on desktop.
 * S5  — Guard done status: rows with "Terminé" badge must not have "Retirer".
 * S6  — Idempotent cancel: cancelling PLANIFIE twice returns 200 both times.
 * S7  — Guard unknown id: DELETE on a non-existent UUID → 404 APPT_NOT_FOUND.
 * S9  — RBAC SECRETAIRE allowed: 200.
 * S10 — RBAC ASSISTANT allowed: 200.
 * S11 — RBAC unauthenticated: 401.
 *
 * REGRESSION GUARD
 * dcf15ec shipped without a sibling IT (no SalleAttenteRemovalIT.java). This
 * file locks the browser-side guards and RBAC paths that were never exercised.
 * SalleAttenteRemovalIT.java provides Testcontainers-backed persistence assertions
 * including the CLOS→409 guard (S5 in the Java IT).
 *
 * Infrastructure notes:
 * 1. baseURL: The helpers.authedApi() uses baseURL 'http://localhost:8080/api' which
 *    resolves absolute paths (/patients) to http://localhost:8080/patients (missing
 *    /api prefix). This spec bypasses that helper and uses baseURL = 'http://localhost:8080'
 *    with explicit /api/ prefix on all calls.
 * 2. Rate limit: The login rate limiter fires after 5 attempts per 15 min/IP. This
 *    spec acquires tokens ONCE in beforeAll and shares them. For browser tests, a
 *    storageState is saved once and reused to avoid additional login calls.
 * 3. firstName constraint: POST /api/patients validates firstName with pattern
 *    [\\p{L}\\s'\\-]+ — digits are NOT allowed. Uniqueness is embedded in the phone
 *    number field (which allows digits) rather than the name.
 * 4. Conflict check: urgency=true bypasses the APPT_CONFLICT check, so tests
 *    work even when the dev DB has leftover appointments at the same time slot.
 *
 * Pre-requisites:
 *   docker compose up -d
 *   mvn spring-boot:run -Dspring-boot.run.profiles=dev
 *   (Vite is started automatically by playwright.config.ts webServer block)
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { apiLogin, uiLogin, USERS } from './helpers';

const API_BASE = 'http://localhost:8080';

/** Create an API context with correct baseURL and a Bearer token. */
async function makeApi(token: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Create a test patient and return its id.
 * firstName must contain only letters — digits go into phone for uniqueness.
 * urgency=true on the appointment skips conflict detection against dev DB data.
 */
async function createPatient(
  api: APIRequestContext,
  firstName: string,
  lastName: string,
  phone: string,
): Promise<string> {
  const res = await api.post('/api/patients', {
    data: {
      firstName,
      lastName,
      gender: 'M',
      birthDate: '1980-01-01',
      phone,
      tier: 'NORMAL',
    },
  });
  const body = await res.json() as { id?: string; code?: string; detail?: string };
  if (!res.ok() || !body.id) {
    throw new Error(`patient creation failed ${res.status()}: ${JSON.stringify(body)}`);
  }
  return body.id;
}

// ── Shared state (module-level so both Playwright projects reuse the same tokens) ──
// Chromium project's beforeAll fills these; mobile project's beforeAll is a no-op if
// they are already set. This prevents the 5-login/15-min rate limit from firing twice.

let medToken: string = '';
let secToken: string = '';
let assToken: string = '';
let medUserId: string = '';
let medApi: APIRequestContext;
let secApi: APIRequestContext;
let assApi: APIRequestContext;

// Saved browser auth state so browser tests don't each re-login.
let medStorageState: Parameters<BrowserContext['addCookies']>[0] extends unknown[]
  ? never
  : Awaited<ReturnType<BrowserContext['storageState']>>;

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe("Salle d'attente — retirer un patient (dcf15ec)", () => {

  test.beforeAll(async ({ browser, request }) => {
    // If tokens are already set (second project run reuses module state), skip logins.
    if (medToken && secToken && assToken && medStorageState) {
      // Recreate API contexts (they were disposed by afterAll of the previous project).
      medApi = await makeApi(medToken);
      secApi = await makeApi(secToken);
      assApi = await makeApi(assToken);
      return;
    }

    // API tokens — 3 logins, shared across all tests.
    const medResult = await apiLogin(request, USERS.medecin.email, USERS.medecin.password);
    medToken = medResult.accessToken;
    medUserId = medResult.user.id;
    medApi = await makeApi(medToken);

    const secResult = await apiLogin(request, USERS.secretaire.email, USERS.secretaire.password);
    secToken = secResult.accessToken;
    secApi = await makeApi(secToken);

    const assResult = await apiLogin(request, USERS.assistant.email, USERS.assistant.password);
    assToken = assResult.accessToken;
    assApi = await makeApi(assToken);

    // Browser auth state — ONE login via UI so browser tests don't re-login.
    // We save storageState (cookies + localStorage) and reuse it per-test.
    const setupCtx = await browser.newContext();
    const setupPage = await setupCtx.newPage();
    await uiLogin(setupPage, USERS.medecin.email, USERS.medecin.password);
    medStorageState = await setupCtx.storageState();
    await setupCtx.close();
  });

  test.afterAll(async () => {
    // Guard: contexts may be undefined if beforeAll itself failed.
    if (medApi) await medApi.dispose();
    if (secApi) await secApi.dispose();
    if (assApi) await assApi.dispose();
  });

  // ── S1: Happy path desktop ────────────────────────────────────────────────
  test('S1. Desktop: Retirer un patient ARRIVE ferme le dialog et vide la file', async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop-only scenario — S2 covers mobile');

    // Phone carries uniqueness so firstName stays letter-only.
    const phone = `+212 6 11 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Un', 'Desktop', phone);

    const startAt = new Date(Date.now() + 35 * 60 * 1000).toISOString();
    const aptRes = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true, // bypass APPT_CONFLICT check against existing dev-DB appointments
      },
    });
    expect(aptRes.status(), `S1 appointment creation must return 201, got: ${await aptRes.text()}`).toBe(201);
    const apt = await aptRes.json() as { id: string };
    expect(apt.id, 'S1 appointment id must be present').toBeTruthy();

    const ci = await medApi.post(`/api/appointments/${apt.id}/check-in`);
    expect(ci.status(), 'check-in must return 204').toBe(204);

    // Reuse saved auth state — no additional login call needed.
    const ctx = await browser.newContext({ storageState: medStorageState });
    const page = await ctx.newPage();

    await page.goto('http://localhost:5173/salle');

    // QueueRow renders aria-label "Retirer <firstName> <lastName> de la liste"
    const retirer = page.getByRole('button', {
      name: /Retirer Salle-Un Desktop de la liste/i,
    });
    await expect(retirer).toBeVisible({ timeout: 12_000 });
    await page.screenshot({ path: 'qa-salle-removal-s1-before-click.png' });

    await retirer.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText(/Retirer de la liste d'attente/i);
    await page.screenshot({ path: 'qa-salle-removal-s1-dialog-open.png' });

    await dialog.getByPlaceholder(/empêchement/i).fill('Empêchement QA S1');
    await page.screenshot({ path: 'qa-salle-removal-s1-motif-filled.png' });

    await dialog.getByRole('button', { name: /^Retirer$/i }).click();

    await expect(page.getByText(/retiré de la liste/i)).toBeVisible({ timeout: 8_000 });
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'qa-salle-removal-s1-after-confirm.png' });

    await ctx.close();

    // Verify via API — HTTP 200 alone is not enough; read the persisted status.
    const aptAfter = await medApi
      .get(`/api/appointments/${apt.id}`)
      .then((r) => r.json() as Promise<{ status: string; cancelReason: string }>);
    expect(aptAfter.status, 'appointment must be ANNULE in DB').toBe('ANNULE');
    expect(aptAfter.cancelReason, 'cancel_reason must be persisted').toBe('Empêchement QA S1');
  });

  // ── S2: Happy path mobile ─────────────────────────────────────────────────
  test('S2. Mobile: circular × button retire le patient et ferme le dialog', async ({
    browser,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile-only scenario — S1 covers desktop');

    const phone = `+212 6 22 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Deux', 'Mobile', phone);

    const startAt = new Date(Date.now() + 40 * 60 * 1000).toISOString();
    const aptRes2 = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true,
      },
    });
    expect(aptRes2.status(), `S2 appointment creation must return 201, got: ${await aptRes2.text()}`).toBe(201);
    const apt = await aptRes2.json() as { id: string };

    const ci2 = await medApi.post(`/api/appointments/${apt.id}/check-in`);
    expect(ci2.status(), 'S2 check-in must return 204').toBe(204);

    const ctx = await browser.newContext({ storageState: medStorageState });
    const page = await ctx.newPage();

    await page.goto('http://localhost:5173/salle');
    await page.screenshot({ path: 'qa-salle-removal-s2-mobile-queue.png' });

    const retirer = page.getByRole('button', {
      name: /Retirer Salle-Deux Mobile/i,
    });
    await expect(retirer).toBeVisible({ timeout: 12_000 });
    await retirer.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText(/Retirer de la liste/i);
    await page.screenshot({ path: 'qa-salle-removal-s2-mobile-dialog.png' });

    await dialog.getByRole('button', { name: /^Retirer$/i }).click();

    await expect(page.getByText(/retiré de la liste/i)).toBeVisible({ timeout: 8_000 });
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'qa-salle-removal-s2-mobile-after.png' });

    await ctx.close();

    const aptAfter = await medApi
      .get(`/api/appointments/${apt.id}`)
      .then((r) => r.json() as Promise<{ status: string }>);
    expect(aptAfter.status, 'appointment must be ANNULE after mobile removal').toBe('ANNULE');
  });

  // ── S3: Cancel without motif ──────────────────────────────────────────────
  test('S3. Cancel sans motif — DELETE sans body, statut ANNULE, cancelReason vide', async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, 'covered by S2 on mobile');

    const phone = `+212 6 33 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Trois', 'NoMotif', phone);

    const startAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();
    const aptRes3 = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true,
      },
    });
    expect(aptRes3.status(), `S3 appointment creation must return 201, got: ${await aptRes3.text()}`).toBe(201);
    const apt = await aptRes3.json() as { id: string };

    const ci3 = await medApi.post(`/api/appointments/${apt.id}/check-in`);
    expect(ci3.status(), 'S3 check-in must return 204').toBe(204);

    const ctx = await browser.newContext({ storageState: medStorageState });
    const page = await ctx.newPage();

    await page.goto('http://localhost:5173/salle');

    const retirer = page.getByRole('button', {
      name: /Retirer Salle-Trois NoMotif/i,
    });
    await expect(retirer).toBeVisible({ timeout: 12_000 });
    await retirer.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Leave motif empty, confirm directly.
    await dialog.getByRole('button', { name: /^Retirer$/i }).click();
    await expect(page.getByText(/retiré de la liste/i)).toBeVisible({ timeout: 8_000 });

    await ctx.close();

    const aptAfter = await medApi
      .get(`/api/appointments/${apt.id}`)
      .then((r) => r.json() as Promise<{ status: string; cancelReason: string | null }>);
    expect(aptAfter.status).toBe('ANNULE');
    expect(
      aptAfter.cancelReason == null || aptAfter.cancelReason === '',
      `cancelReason should be empty, got: ${String(aptAfter.cancelReason)}`,
    ).toBeTruthy();
  });

  // ── S4: Guard — consult status hides "Retirer" ────────────────────────────
  test('S4. Guard desktop: patient EN_CONSULTATION — bouton Retirer absent', async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop QueueRow condition — mobile uses separate component');

    const phone = `+212 6 44 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Quatre', 'Consult', phone);

    const startAt = new Date(Date.now() + 50 * 60 * 1000).toISOString();
    const aptRes4 = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true,
      },
    });
    expect(aptRes4.status(), `S4 appointment creation must return 201, got: ${await aptRes4.text()}`).toBe(201);
    const apt = await aptRes4.json() as { id: string };

    const ci4 = await medApi.post(`/api/appointments/${apt.id}/check-in`);
    expect(ci4.status(), 'S4 check-in must return 204').toBe(204);
    // Start consultation WITH appointmentId so ConsultationService transitions appointment to EN_CONSULTATION.
    const consult = await medApi.post('/api/consultations', {
      data: { patientId, appointmentId: apt.id, motif: 'QA S4 guard' },
    });
    expect(consult.status(), 'S4 consultation start must return 201').toBe(201);

    const ctx = await browser.newContext({ storageState: medStorageState });
    const page = await ctx.newPage();

    await page.goto('http://localhost:5173/salle');
    await page.screenshot({ path: 'qa-salle-removal-s4-consult-status.png' });

    // The "Retirer" button for this specific patient must NOT appear.
    const retirer = page.getByRole('button', {
      name: /Retirer Salle-Quatre Consult/i,
    });
    await expect(retirer).toHaveCount(0);

    await ctx.close();
  });

  // ── S5: Guard — done rows have no "Retirer" ───────────────────────────────
  test('S5. Guard: les lignes "Terminé" nont pas de bouton Retirer', async ({
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop QueueRow — mobile uses separate component');

    const ctx = await browser.newContext({ storageState: medStorageState });
    const page = await ctx.newPage();

    await page.goto('http://localhost:5173/salle');
    await page.screenshot({ path: 'qa-salle-removal-s5-done-check.png' });

    const doneRows = page.locator('tr').filter({ hasText: /Terminé|Signé/i });
    const doneCount = await doneRows.count();

    for (let i = 0; i < doneCount; i++) {
      const row = doneRows.nth(i);
      await expect(row.getByRole('button', { name: /Retirer/i })).toHaveCount(0);
    }

    await ctx.close();
  });

  // ── S6: Idempotent cancel (API) ───────────────────────────────────────────
  test('S6. Idempotent cancel: annuler deux fois retourne 200, statut reste ANNULE', async () => {
    const phone = `+212 6 66 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Six', 'Idem', phone);

    const startAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();
    const aptRes6 = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true,
      },
    });
    expect(aptRes6.status(), `S6 appointment creation must return 201, got: ${await aptRes6.text()}`).toBe(201);
    const apt = await aptRes6.json() as { id: string };

    const res1 = await medApi.delete(`/api/appointments/${apt.id}`, {
      data: { reason: 'First cancel' },
    });
    expect(res1.status(), 'first cancel must return 200').toBe(200);

    const res2 = await medApi.delete(`/api/appointments/${apt.id}`, {
      data: { reason: 'Second cancel attempt' },
    });
    expect(res2.status(), 'idempotent cancel must return 200').toBe(200);
    const body2 = await res2.json() as { status: string };
    expect(body2.status, 'idempotent cancel must return ANNULE').toBe('ANNULE');
  });

  // ── S7: Guard unknown id ──────────────────────────────────────────────────
  test('S7. Guard: id inconnu → DELETE retourne 404 APPT_NOT_FOUND', async () => {
    const unknownId = '00000000-dead-beef-0000-000000000000';
    const res = await medApi.delete(`/api/appointments/${unknownId}`, {
      data: { reason: 'test guard' },
    });
    expect(res.status(), 'unknown id must return 404').toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('APPT_NOT_FOUND');
  });

  // ── S9: RBAC SECRETAIRE allowed ───────────────────────────────────────────
  test('S9. RBAC: SECRETAIRE peut annuler un RDV → 200', async () => {
    const phone = `+212 6 99 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Neuf', 'SecRBAC', phone);

    const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const aptRes9 = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true,
      },
    });
    expect(aptRes9.status(), `S9 appointment creation must return 201, got: ${await aptRes9.text()}`).toBe(201);
    const apt = await aptRes9.json() as { id: string };

    const res = await secApi.delete(`/api/appointments/${apt.id}`, {
      data: { reason: 'SECRETAIRE QA S9' },
    });
    expect(res.status(), 'SECRETAIRE must get 200').toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ANNULE');
  });

  // ── S10: RBAC ASSISTANT allowed ───────────────────────────────────────────
  test('S10. RBAC: ASSISTANT peut annuler un RDV → 200', async () => {
    const phone = `+212 6 10 ${Date.now().toString().slice(-8, -4)} ${Date.now().toString().slice(-4)}`;
    const patientId = await createPatient(medApi, 'Salle-Dix', 'AssistRBAC', phone);

    const startAt = new Date(Date.now() + 70 * 60 * 1000).toISOString();
    const aptRes10 = await medApi.post('/api/appointments', {
      data: {
        patientId,
        practitionerId: medUserId,
        startAt,
        durationMinutes: 30,
        walkIn: true,
        urgency: true,
      },
    });
    expect(aptRes10.status(), `S10 appointment creation must return 201, got: ${await aptRes10.text()}`).toBe(201);
    const apt = await aptRes10.json() as { id: string };

    const res = await assApi.delete(`/api/appointments/${apt.id}`, {
      data: { reason: 'ASSISTANT QA S10' },
    });
    expect(res.status(), 'ASSISTANT must get 200').toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ANNULE');
  });

  // ── S11: RBAC unauthenticated ─────────────────────────────────────────────
  test('S11. RBAC: DELETE sans token → 401', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const fakeId = '00000000-0000-0000-0000-000000000099';
    const res = await ctx.delete(`/api/appointments/${fakeId}`);
    expect(res.status(), 'unauthenticated DELETE must return 401').toBe(401);
    await ctx.dispose();
  });
});
