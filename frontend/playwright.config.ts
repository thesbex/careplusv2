import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for careplus end-to-end tests.
 *
 * Pre-requisites:
 *   - Postgres up:                 docker compose up -d
 *   - Spring Boot dev profile up:  mvn spring-boot:run -Dspring-boot.run.profiles=dev
 *   - Vite dev server up:          (auto-started below via webServer)
 *
 * The dev profile seeds:
 *   - 3 users (medecin: youssef.elamrani@careplus.ma / pw ChangeMe123!,
 *              secretaire: fatima.zahra@careplus.ma,
 *              assistant: khadija.bennis@careplus.ma)
 *   - 5 demo patients
 *   - 146 medications, 66 lab tests, 44 imaging exams
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // share state via the same backend
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Vite is launched automatically; the backend must be started manually
  // (start it before running `npm run e2e`).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
