/**
 * IHM regression suite — locks the bugs surfaced during the manual IHM QA
 * pass on 2026-05-01 (vs. the API-only QA that missed them all).
 *
 * Each test pins ONE bug:
 *   1. /constantes refuse de rendre le formulaire si le patient ne peut pas
 *      être chargé — pas de retombée sur le fixture "Youssef Ziani"
 *   2. Le formulaire constantes démarre VIDE — aucun TA / IMC pré-rempli
 *   3. Onglet Tarifs ne déclenche pas "Maximum update depth exceeded"
 *   4. Liste consultations affiche le nom du patient (pas que l'UUID)
 *      — laissé en xfail tant que le backend ne joint pas le nom
 *   5. La saisie d'une allergie de sévérité inconnue est rejetée par le
 *      backend (CHECK constraint V017) au lieu d'empoisonner le patient
 *
 * Pré-requis : Spring Boot + Vite up, dev profile (cf. playwright.config.ts).
 */
import { expect, test } from '@playwright/test';
import { apiLogin, authedApi, uiLogin, USERS } from './helpers';

test.describe('IHM regressions — 2026-05-01 manual QA findings', () => {

  test('1. /constantes shows error gate when patient/appointment fail to load', async ({ page, request }) => {
    // Login + grab a real practitioner id
    const { accessToken, user } = await apiLogin(request, USERS.medecin.email, USERS.medecin.password);
    const api = await authedApi(accessToken);

    // Pick any patient
    const patients = await api.get('/patients').then((r) => r.json());
    expect(Array.isArray(patients), 'patients endpoint returned an array').toBeTruthy();
    expect(patients.length).toBeGreaterThan(0);
    const patientId = patients[0].id;

    // Create a future appointment (avoids holiday + past validations)
    const startAt = '2026-05-04T11:00:00Z';
    const endAt = '2026-05-04T11:30:00Z';
    const apt = await api
      .post('/appointments', {
        data: {
          patientId,
          practitionerId: user.id,
          startAt,
          endAt,
          type: 'CONSULTATION',
        },
      })
      .then((r) => r.json());
    expect(apt.id, 'appointment was created').toBeTruthy();

    // Navigate to a non-existent appointment id — both useAppointment and
    // usePatient will fail. The page MUST show the error gate, not the form.
    await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
    await page.goto('/constantes/00000000-0000-0000-0000-000000000000');

    // Expect: error alert, NOT a form pre-filled with fixtures.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    // The Youssef Ziani fixture must NEVER appear on this page.
    await expect(page.getByText('Youssef Ziani')).toHaveCount(0);
    // No "Repères (H 30-50 ans)" reference panel either, because there is no patient.
    await expect(page.getByText(/Repères/)).toHaveCount(0);
  });

  test('2. /constantes form starts blank — no DEFAULT_VITALS pre-fill', async ({ page, request }) => {
    const { accessToken, user } = await apiLogin(request, USERS.medecin.email, USERS.medecin.password);
    const api = await authedApi(accessToken);
    const patients = await api.get('/patients').then((r) => r.json());
    const patientId = patients[0].id;

    // Make a real same-week appointment + check it in (so it's reachable).
    const apt = await api
      .post('/appointments', {
        data: {
          patientId,
          practitionerId: user.id,
          startAt: '2026-05-04T12:00:00Z',
          endAt: '2026-05-04T12:30:00Z',
          type: 'CONSULTATION',
        },
      })
      .then((r) => r.json());
    await api.post(`/appointments/${apt.id}/check-in`);

    await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
    await page.goto(`/constantes/${apt.id}`);

    // Wait for form to be visible (patient loaded).
    await expect(page.getByLabel('Tension systolique')).toBeVisible({ timeout: 10_000 });

    // Each numeric vital must be empty — never the prototype defaults
    // (132 / 84 / 78 / 98 / 36.9 / 74 / 178).
    for (const label of ['Tension systolique', 'Tension diastolique', 'Fréquence cardiaque', 'Saturation O₂', 'Température', 'Poids', 'Taille']) {
      const value = await page.getByLabel(label).inputValue();
      expect(value, `${label} should start empty`).toBe('');
    }

    // The motif textarea must NOT contain the fixture sentence.
    const notes = page.getByLabel('Motif déclaré par le patient');
    if (await notes.count()) {
      const v = await notes.inputValue();
      expect(v).not.toContain('Patient vient pour première consultation');
    }

    // The "TA légèrement élevée" amber callout must NOT show without input.
    await expect(page.getByText('TA légèrement élevée')).toHaveCount(0);
  });

  test('3. Tarifs tab does not trigger "Maximum update depth exceeded"', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
    await page.goto('/parametres');

    // Switch to Tarifs and let it render for a moment.
    await page.getByRole('tab', { name: 'Tarifs' }).click();
    await page.waitForTimeout(800); // give an unbounded loop time to scream

    const loopErrors = consoleErrors.filter((e) =>
      /Maximum update depth exceeded/i.test(e),
    );
    expect(loopErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);

    // Sanity: the panel rendered.
    await expect(page.getByText(/Remises automatiques/i)).toBeVisible();
  });

  test('4. Backend rejects allergy with unknown severity (V017 CHECK constraint)', async ({ request }) => {
    const { accessToken, user } = await apiLogin(request, USERS.medecin.email, USERS.medecin.password);
    const api = await authedApi(accessToken);

    // Create a fresh patient so this test is isolated.
    const created = await api
      .post('/patients', {
        data: {
          firstName: 'TestAllergy',
          lastName: 'CHECK-Constraint',
          gender: 'M',
          birthDate: '1990-01-01',
          phone: '+212 6 00 00 00 00',
          city: 'Casablanca',
          tier: 'NORMAL',
        },
      })
      .then((r) => r.json());
    expect(created.id).toBeTruthy();

    // Try to add an allergy with a severity that's NOT in the enum.
    // Goes through the API — and even if the API mapper would accept it,
    // the V017 DB CHECK should refuse the row.
    const bad = await api.post(`/patients/${created.id}/allergies`, {
      data: { substance: 'Test', severity: 'GRAVE' }, // GRAVE is not in the enum
    });
    expect(
      [400, 409, 422, 500].includes(bad.status()),
      `expected a rejection, got ${bad.status()}`,
    ).toBeTruthy();

    // Whatever happened above, the patient must STILL be readable — no
    // poisoned row should make GET /patients/{id} crash.
    const reread = await api.get(`/patients/${created.id}`);
    expect(reread.status(), 'patient is still readable after the bad allergy attempt').toBe(200);

    // Cleanup so reruns stay green.
    await api.delete(`/patients/${created.id}`);
    void user;
  });

  test.fixme(
    '5. Consultations list shows patient name, not UUID prefix',
    async ({ page }) => {
      // Backend currently returns no patient name in the consultations list,
      // so the UI shows "Patient 1741C1E0". When the backend joins the name
      // (audit BACKLOG.md), flip this from .fixme to active.
      await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
      await page.goto('/consultations');
      // Expect at least one row that does NOT start with "Patient " followed
      // by 8 hex chars.
      const rows = page.locator('button:has-text("Consultation")');
      const count = await rows.count();
      let sawName = false;
      for (let i = 0; i < count; i++) {
        const text = await rows.nth(i).innerText();
        if (!/Patient [0-9A-F]{8}/.test(text)) {
          sawName = true;
          break;
        }
      }
      expect(sawName, 'at least one consultation row should show a real patient name').toBeTruthy();
    },
  );
});
