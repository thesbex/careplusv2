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
 *   6. Une consultation SIGNEE permet TOUJOURS de téléverser un résultat
 *      LAB / IMAGING (le patient ramène ses analyses des jours après —
 *      rapport Y. Boutaleb 2026-05-01)
 *   7. Quand l'OS n'expose AUCUNE caméra (Windows Privacy = OFF, kill-switch),
 *      la modale « Photographier » affiche un titre + des consignes
 *      actionnables, pas seulement « Aucune caméra détectée » sans suite
 *   8. Import CSV catalogue médicaments — le bouton « Importer CSV » envoie
 *      le fichier au bon endpoint et la table affiche les lignes ajoutées
 *      sans recharger la page (rapport Y. Boutaleb 2026-05-01)
 *   9. SECRETAIRE ne voit PAS le bouton « Importer CSV » (gate front) — et
 *      même en POST direct, le backend retourne 403 (gate Spring Security)
 *
 * Pré-requis : Spring Boot + Vite up, dev profile (cf. playwright.config.ts).
 *
 * Viewports : la suite tourne dans les deux projects Playwright (`chromium`
 * desktop + `mobile` Pixel 5). Les scénarios marqués `test.skip(isMobile,
 * '… feature gap')` correspondent à des features non encore portées sur
 * mobile (Tarifs admin, Téléverser résultat post-sign, Photographier patient,
 * Importer CSV catalogue) — chacun est un GAP à corriger.
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
    // (132 / 84 / 78 / 98 / 36.9 / 74 / 178). Les regex /^Poids/ et /^Taille/
    // matchent à la fois desktop (`aria-label="Poids"`) et mobile
    // (`aria-label="Poids (kg)"`), ce qui permet à ce test de tourner
    // dans les deux projects Playwright.
    const labels: (string | RegExp)[] = [
      'Tension systolique',
      'Tension diastolique',
      'Fréquence cardiaque',
      'Saturation O₂',
      'Température',
      /^Poids/,
      /^Taille/,
    ];
    for (const label of labels) {
      const value = await page.getByLabel(label).inputValue();
      expect(value, `${String(label)} should start empty`).toBe('');
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

  test('3. Tarifs tab does not trigger "Maximum update depth exceeded"', async ({ page, isMobile }) => {
    // ParametragePage.mobile.tsx est un menu de liens (pas d'onglets), donc
    // pas de surface "Tarifs" sur mobile pour reproduire la boucle de re-render.
    // GAP : si on porte un jour les onglets admin (Tarifs / Prestations / Droits)
    // sur mobile, retirer ce skip et adapter le sélecteur.
    test.skip(isMobile, 'Mobile parametres has no Tarifs tab — feature is desktop-only');
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

  test('6. SIGNEE consultation still allows uploading LAB/IMAGING result (Y. Boutaleb 2026-05-01)', async ({ page, request, isMobile }) => {
    // Mobile ConsultationPage.mobile.tsx n'expose PAS le bouton « Téléverser
    // résultat » sur les lignes de prescription LAB/IMAGING — il n'y a que la
    // liste des ordonnances générées. GAP mobile : porter le DocumentUploadButton
    // dans la mobile variant. Tant que ce n'est pas fait, on skip ici.
    test.skip(isMobile, 'Mobile consultation lacks « Téléverser résultat » button — feature gap');
    // Le médecin signe une consultation et le patient revient des jours plus
    // tard avec ses analyses / radios. Avant le fix, le bouton « Téléverser
    // résultat » était désactivé dès que la consultation passait à SIGNEE
    // → impossible d'attacher quoi que ce soit après signature.
    const { accessToken } = await apiLogin(request, USERS.medecin.email, USERS.medecin.password);
    const api = await authedApi(accessToken);

    // Pick any patient + a real lab test from the catalog.
    const patients = await api.get('/patients').then((r) => r.json());
    const patientId = patients[0].id;
    const labTests = await api.get('/catalog/lab-tests?q=NFS').then((r) => r.json());
    expect(labTests.length, 'at least one lab test seeded').toBeGreaterThan(0);
    const labTestId = labTests[0].id;

    // Build a SIGNEE consultation with a LAB prescription.
    const consult = await api
      .post('/consultations', { data: { patientId, motif: 'QA result post-sign' } })
      .then((r) => r.json());
    await api.put(`/consultations/${consult.id}`, {
      data: { motif: 'Bilan', examination: 'OK', diagnosis: 'Inflammatoire', notes: '' },
    });
    const rx = await api
      .post(`/consultations/${consult.id}/prescriptions`, {
        data: {
          type: 'LAB',
          allergyOverride: false,
          lines: [{ labTestId, instructions: 'a jeun le matin' }],
        },
      })
      .then((r) => r.json());
    expect(rx.id, 'LAB prescription created').toBeTruthy();
    const lineId = rx.lines[0].id;

    const signed = await api.post(`/consultations/${consult.id}/sign`);
    expect(signed.status()).toBe(200);

    // Open the signed consultation in the browser.
    await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
    await page.goto(`/consultations/${consult.id}`);

    // The « Téléverser résultat » button must be visible AND enabled even
    // though the consultation is SIGNEE.
    const upload = page
      .getByRole('button', { name: /Téléverser résultat/i })
      .first();
    await expect(upload).toBeVisible({ timeout: 10_000 });
    await expect(upload).toBeEnabled();

    // End-to-end : upload through the API path the button hits, then refresh
    // the page and assert that the « Voir résultat » link replaced the upload
    // CTA on that line.
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xa3, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const upRes = await api.put(`/prescriptions/lines/${lineId}/result`, {
      multipart: { file: { name: 'qa.png', mimeType: 'image/png', buffer: png } },
    });
    expect(upRes.status(), 'PUT result returned 200').toBe(200);

    await page.reload();
    await expect(page.getByText(/Voir résultat/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('7. Webcam modal surfaces actionable hints when OS hides every camera', async ({ page, isMobile }) => {
    // PatientsListPage.mobile.tsx n'a pas de CTA « Nouveau patient » → la
    // modale « Photographier » n'est accessible que depuis le desktop.
    // GAP : porter la création patient + capture photo sur mobile.
    test.skip(isMobile, 'Mobile patients screen has no « Nouveau patient » CTA — feature gap');
    // Pin the new diagnostic UX (vs. the dead-end "Aucune caméra détectée"
    // pré-2026-05-01). We force the test to behave like a PC where the OS
    // refuses to expose any video device — same situation Chrome reports
    // on Windows when Privacy → Caméra is OFF.
    await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
    await page.goto('/patients');

    // Patch the browser BEFORE the user action so the dialog mounts with
    // navigator.mediaDevices already returning "no videoinput".
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = navigator.mediaDevices as any;
      md.enumerateDevices = () => Promise.resolve([
        { kind: 'audiooutput', label: '', deviceId: '' },
      ]);
      md.getUserMedia = () =>
        Promise.reject(new DOMException('Requested device not found', 'NotFoundError'));
    });
    await page.reload();

    await page.getByRole('button', { name: /Nouveau patient/ }).click();
    await page.getByRole('button', { name: /^Photographier$/ }).click();

    // Title + detail + first hint must be visible.
    const alert = page.getByRole('alert').first();
    await expect(alert).toBeVisible({ timeout: 5_000 });
    await expect(alert).toContainText(/Aucune caméra accessible/);
    await expect(alert).toContainText(/Paramètres → Confidentialité/);
    await expect(alert).toContainText(/commutateur physique/);
    // Underlying DOMException name surfaced for debug.
    await expect(alert).toContainText(/code\s*:\s*NotFoundError/);

    // « Capturer » must be disabled — no stream, no capture.
    await expect(page.getByRole('button', { name: /^Capturer$/ })).toBeDisabled();
  });

  test('8. Catalog meds CSV import — drag the file into the IHM, table updates', async ({ page, isMobile }) => {
    // CataloguePage.mobile.tsx n'embarque pas le `CatalogImportButton` — le
    // bouton « Importer CSV » n'existe que côté desktop. GAP mobile : porter
    // le bouton (le service backend est déjà multi-rôle, c'est purement UI).
    test.skip(isMobile, 'Mobile catalogue lacks « Importer CSV » button — feature gap');
    // QA5-2 — le médecin doit pouvoir étoffer son catalogue depuis un CSV
    // (DCI / forme / dosage non encore connus). Le bouton « Importer CSV »
    // envoie le fichier en multipart à /catalog/medications/import.
    await uiLogin(page, USERS.medecin.email, USERS.medecin.password);
    await page.goto('/catalogue');

    // Two QA-prefixed rows that won't collide with the seed data even on
    // re-runs (upsert by commercial_name+dci+form+dosage).
    const stamp = Date.now();
    const csv = [
      'commercial_name,dci,form,dosage,atc_code,tags,active',
      `QA-IHM-${stamp},Guaifenesine,sirop,200mg/5ml,R05CA03,mucolytique,true`,
      `QA-IHM-${stamp}-bis,Paracetamol,suppositoire,150mg,N02BE01,antalgique,true`,
    ].join('\n');

    // Wait for « Importer CSV » to be visible (RBAC: MEDECIN sees it).
    const importButton = page.getByRole('button', { name: /Importer CSV/i });
    await expect(importButton).toBeVisible({ timeout: 10_000 });

    // setInputFiles works against the hidden <input type="file"> the button
    // proxies to — same code path as a real user picking a file.
    const fileInput = page.locator('input[type="file"][accept*="csv"]');
    await fileInput.setInputFiles({
      name: `qa-${stamp}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    });

    // Either « Import OK » (everything new) or « Import partiel » (re-run hit
    // upsert path) — both are success states.
    await expect(page.getByText(/Import OK|Import partiel/i)).toBeVisible({
      timeout: 10_000,
    });

    // The freshly-imported rows must surface in the table without a page
    // reload — proves the refresh-tick wiring fires after the import.
    await expect(page.getByText(`QA-IHM-${stamp}`).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(`QA-IHM-${stamp}-bis`).first()).toBeVisible();
  });

  test('9. SECRETAIRE: « Importer CSV » button is hidden in the IHM', async ({ page, isMobile }) => {
    // Le bouton n'existe pas en mobile (cf. test 8). L'assertion mobile serait
    // vacuously true. On skip pour ne pas masquer un futur portage qui
    // oublierait le gate RBAC côté mobile.
    test.skip(isMobile, 'Mobile catalogue lacks the button entirely — gate is N/A');
    // Front-side gate (RBAC store filters by role). The matching backend 403
    // path is covered by CatalogImportIT.importMedications_secretaire_returns403
    // — keeping it out of Playwright avoids exhausting the login rate limit
    // (5 / 15 min / IP) when the suite re-runs locally.
    await uiLogin(page, USERS.secretaire.email, USERS.secretaire.password);
    await page.goto('/catalogue');
    await expect(page.getByText(/médicament/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: /Importer CSV/i })).toHaveCount(0);
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
