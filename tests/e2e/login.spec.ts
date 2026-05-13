import { test, expect } from '@playwright/test';

const TEST_ID = '7d46f854-01bd-4ace-bb3a-f900e55eba9a';
const TEST_NAME = 'PEDRO FLORES BANEGAS';
const TEST_CARNET = '8989079';

test('login completo con Pedro Flores', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/Festival DanzArte/);

  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.getByText(TEST_NAME, { exact: false }).first().click();

  await page.getByPlaceholder('Su número de carnet').fill(TEST_CARNET);
  await page.getByRole('button', { name: /Ingresar/i }).click();

  await expect(page).toHaveURL(/\/inscripciones/, { timeout: 10_000 });
  await expect(page.getByText(TEST_NAME)).toBeVisible();
});

test('login con password incorrecto muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.getByText(TEST_NAME, { exact: false }).first().click();
  await page.getByPlaceholder('Su número de carnet').fill('WRONG_PASSWORD');
  await page.getByRole('button', { name: /Ingresar/i }).click();

  await expect(page.getByText(/Carnet o contraseña incorrectos/i)).toBeVisible();
});

test('ruta protegida sin sesión redirige a login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/inscripciones');
  await expect(page).toHaveURL(/\/login/);
});

test('login con teléfono como password también funciona', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.getByText(TEST_NAME, { exact: false }).first().click();
  await page.getByPlaceholder('Su número de carnet').fill('69166318');
  await page.getByRole('button', { name: /Ingresar/i }).click();

  await expect(page).toHaveURL(/\/inscripciones/, { timeout: 10_000 });
});

test.skip(!TEST_ID, 'TEST_ID required');
