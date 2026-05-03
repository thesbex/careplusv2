import { request, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:8080/api';

export const USERS = {
  medecin: { email: 'youssef.elamrani@careplus.ma', password: 'ChangeMe123!' },
  secretaire: { email: 'fatima.zahra@careplus.ma', password: 'ChangeMe123!' },
  assistant: { email: 'khadija.bennis@careplus.ma', password: 'ChangeMe123!' },
};

export interface LoginResult {
  accessToken: string;
  user: { id: string; email: string; firstName: string; lastName: string; roles: string[] };
}

/** Login via the API and return the access token + user. */
export async function apiLogin(
  ctx: APIRequestContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

/** Standalone API context with the bearer token attached. */
export async function authedApi(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/** Drives the UI login form so subsequent navigation runs as that user. */
export async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  // Exact labels — the page also contains "Mot de passe oublié" + show/hide
  // aria-label, which would make a loose regex ambiguous in strict mode.
  await page.getByLabel(/^Adresse e[- ]?mail$/i).fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 10_000 });
}
