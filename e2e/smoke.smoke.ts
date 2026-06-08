/**
 * e2e/smoke.smoke.ts
 * HRMS1 browser smoke tests — validates that key pages load without crashing.
 *
 * Strategy:
 *  - Uses demo sessions (localStorage injection) so tests never depend on a
 *    live backend or seeded database.
 *  - VITE_ENABLE_DEMO_LOGIN=true must be set in the build/dev server so the
 *    frontend AuthContext accepts the injected session.
 *  - Tests assert page structure (heading, nav, card) not dynamic data counts.
 */
import { test, expect } from '@playwright/test';
import { injectDemoSession, assertNotCrashed, waitForAppShell } from './helpers';

// ── 1. Auth page loads without login ─────────────────────────────────────────
test('auth page loads', async ({ page }) => {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);

  // Login form must be visible
  await expect(page.locator('#identifier')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

// ── 2. Login with admin credentials ──────────────────────────────────────────
test('admin login navigates to dashboard', async ({ page }) => {
  await page.goto('/auth');
  await page.waitForLoadState('domcontentloaded');

  await page.locator('#identifier').fill('admin@mascallnet.com');
  await page.locator('#password').fill('Admin@123');
  await page.locator('button[type="submit"]').click();

  // Should redirect to /dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await assertNotCrashed(page);
  await waitForAppShell(page);

  expect(page.url()).toContain('/dashboard');
});

// ── 3–10. Protected pages — use injected demo session ────────────────────────
// These tests inject the admin demo session via localStorage before page load,
// bypassing the login form entirely.

test('dashboard loads after session inject', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  // Should still be on dashboard, not redirected to /auth
  expect(page.url()).toContain('/dashboard');
});

test('employees page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/employees');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  // Page should show "Employee" text somewhere
  await expect(page.locator('body')).toContainText(/employee/i);
});

test('ATS dashboard loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/ats/dashboard');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/ats|recruitment|candidate/i);
});

test('ATS candidate master loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/ats/candidate-master');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/candidate/i);
});

test('attendance page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/attendance');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/attendance/i);
});

test('WFM roster page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/wfm/roster');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/roster|wfm|workforce/i);
});

test('leave page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/leaves');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/leave/i);
});

test('work inbox (task) page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/work-inbox');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/inbox|task|work/i);
});

test('KPI config page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/kpi-config');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/kpi/i);
});

test('process config page loads', async ({ page }) => {
  await injectDemoSession(page, 'admin');
  await page.goto('/process-config');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/process/i);
});

test('client portal login page loads', async ({ page }) => {
  await page.goto('/portal/login');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  // Portal login should show some form or portal branding
  await expect(page.locator('body')).toContainText(/portal|login|client/i);
});

// ── HR role smoke ─────────────────────────────────────────────────────────────
test('HR role can reach employees page', async ({ page }) => {
  await injectDemoSession(page, 'hr');
  await page.goto('/employees');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  expect(page.url()).toContain('/employees');
});

// ── TL role smoke ─────────────────────────────────────────────────────────────
test('TL role can reach WFM roster page', async ({ page }) => {
  await injectDemoSession(page, 'tl');
  await page.goto('/wfm/roster');
  await page.waitForLoadState('networkidle');

  await assertNotCrashed(page);
  await waitForAppShell(page);

  await expect(page.locator('body')).toContainText(/roster|wfm|workforce/i);
});
