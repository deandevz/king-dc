import { expect, test } from '@playwright/test';
import { finishOnboarding, signIn, typeCode } from './helpers';

test.beforeEach(async ({ request }) => {
  await request.post('/api/__reset');
});

test('sem sessão, qualquer rota cai no login', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar no servidor' })).toBeVisible();
});

test('admin entra, passa pelo onboarding e chega no app', async ({ page }) => {
  await signIn(page, 'ADMKNG', 'admin123');
  await finishOnboarding(page, 'bruce');

  await expect(page.getByRole('heading', { name: 'Escolha um canal' })).toBeVisible();
  await expect(page.getByText('bruce', { exact: true })).toBeVisible();
});

test('código inválido e convite vencido mostram erros diferentes', async ({ page }) => {
  await signIn(page, 'ZZZZZZ', 'senhaerrada');
  await expect(page.getByText('Código ou senha incorretos.')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  await page.reload();
  await signIn(page, 'EXPRD2', 'senhanova123');
  await expect(
    page.getByText('Esse convite já foi usado ou expirou. Peça outro.'),
  ).toBeVisible();
});

test('convite não usado cria a conta e leva para o onboarding', async ({ page }) => {
  await signIn(page, 'KNG742', 'convidado123');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: 'Como você quer aparecer?' })).toBeVisible();
});

test('o nick para em 24 caracteres', async ({ page }) => {
  await signIn(page, 'KNG742', 'convidado123');
  await expect(page).toHaveURL(/\/onboarding$/);

  const nick = page.getByLabel('Nick');
  await nick.fill('a'.repeat(25));

  await expect(nick).toHaveValue('a'.repeat(24));
  await expect(page.getByText('24 / 24')).toBeVisible();
});

test('a prévia da sidebar acompanha o nick digitado', async ({ page }) => {
  await signIn(page, 'KNG742', 'convidado123');
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel('Nick').fill('duda');
  await expect(page.getByText('duda', { exact: true })).toBeVisible();
});

test('com sessão, /login devolve para o app', async ({ page }) => {
  await signIn(page, 'BRUCE7', 'bruce123');
  await expect(page).toHaveURL(/\/app$/);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/app$/);
});

test('o código só aceita o alfabeto do convite', async ({ page }) => {
  await page.goto('/login');
  await typeCode(page, 'ab0o1i');

  await expect(page.getByLabel('Caractere 1 de 6')).toHaveValue('A');
  await expect(page.getByLabel('Caractere 2 de 6')).toHaveValue('B');
  await expect(page.getByLabel('Caractere 3 de 6')).toHaveValue('');
});

test('nick com caractere invisível mostra o erro da API embaixo do campo', async ({ page }) => {
  await signIn(page, 'KNG742', 'convidado123');
  await expect(page).toHaveURL(/\/onboarding$/);

  const nick = page.getByLabel('Nick');
  await nick.fill('ze\u200Bro');
  await page.getByRole('button', { name: 'Entrar no King DC' }).click();

  await expect(nick).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/sem caracteres de controle/)).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding$/);

  // Corrigir o campo limpa o erro e o salvamento segue normal.
  await nick.fill('zero');
  await expect(nick).toHaveAttribute('aria-invalid', 'false');
  await page.getByRole('button', { name: 'Entrar no King DC' }).click();
  await expect(page).toHaveURL(/\/app$/);
});
