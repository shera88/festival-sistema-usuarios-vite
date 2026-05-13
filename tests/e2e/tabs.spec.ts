import { test, expect, type Page } from '@playwright/test';

const TEST_NAME = 'PEDRO FLORES BANEGAS';
const TEST_CARNET = '8989079';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.getByText(TEST_NAME, { exact: false }).first().click();
  await page.getByPlaceholder('Su número de carnet').fill(TEST_CARNET);
  await page.getByRole('button', { name: /Ingresar/i }).click();
  await page.waitForURL(/\/inscripciones/, { timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test('navegar entre las 5 tabs', async ({ page }) => {
  for (const tab of ['Inscripciones', 'Kardex', 'Calificaciones', 'Videos', 'Pagos']) {
    await page.getByRole('link', { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`/${tab.toLowerCase()}`));
  }
});

test('inscripciones: cambiar año recarga lista', async ({ page }) => {
  await page.getByRole('link', { name: 'Inscripciones' }).click();
  await page.getByRole('button', { name: '2025' }).click();
  // Esperar que las queries se asienten
  await page.waitForTimeout(1500);
  // 2025 tiene data para Pedro Flores
  await expect(page.locator('text=AL SON DE LOS CASCABELES').first()).toBeVisible({
    timeout: 10_000,
  });
});

test('kardex: agrupado por institución', async ({ page }) => {
  await page.getByRole('link', { name: 'Kardex' }).click();
  await page.getByRole('button', { name: '2025' }).click();
  await page.waitForTimeout(2000);
  await expect(page.locator('text=BALLET FUERZA Y JUVENTUD').first()).toBeVisible({
    timeout: 10_000,
  });
});

test('calificaciones: muestra puntajes', async ({ page }) => {
  await page.getByRole('link', { name: 'Calificaciones' }).click();
  await page.waitForTimeout(3000);
  // Score formato N.N/100
  await expect(page.locator('text=/\\d+\\.\\d.*\\/100/').first()).toBeVisible({
    timeout: 10_000,
  });
});

test('videos: grid + modal con Vimeo iframe', async ({ page }) => {
  await page.getByRole('link', { name: 'Videos' }).click();
  await page.waitForTimeout(3000);
  // Click primera card de video
  const card = page.locator('button:has(img[src*="vumbnail.com"])').first();
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  // Modal con iframe Vimeo
  await expect(page.locator('iframe[src*="player.vimeo.com"]')).toBeVisible();
  // Cerrar con Escape
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe[src*="player.vimeo.com"]')).not.toBeVisible();
});

test('pagos: empty state placeholder', async ({ page }) => {
  await page.getByRole('link', { name: 'Pagos' }).click();
  await expect(page.getByText(/Pr[oó]ximamente/i)).toBeVisible();
});

test('logout cierra sesión y redirige a login', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Salir/i }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('sync invalida queries (botón gira)', async ({ page }) => {
  const syncBtn = page.getByRole('button', { name: /Sincronizar/i });
  await syncBtn.click();
  // Botón disabled temporalmente
  await expect(syncBtn).toBeDisabled();
});
