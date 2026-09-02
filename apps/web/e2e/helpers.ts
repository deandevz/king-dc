import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Digita nas 6 caixas do código: cada tecla avança o foco sozinha. */
export async function typeCode(page: Page, code: string): Promise<void> {
  await page.getByLabel('Caractere 1 de 6').click();
  await page.keyboard.type(code, { delay: 20 });
}

export async function signIn(page: Page, code: string, password: string): Promise<void> {
  await page.goto('/login');
  await typeCode(page, code);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export async function finishOnboarding(page: Page, nickname: string): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel('Nick').fill(nickname);
  await page.getByRole('button', { name: 'Entrar no King DC' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** Admin do seed do mock: entra e completa o onboarding, que ainda está pendente. */
export async function signInAsAdmin(page: Page): Promise<void> {
  await signIn(page, 'ADMKNG', 'admin123');
  await finishOnboarding(page, 'bruce');
}

/** Usuário do mock que já tem nick: cai direto no app. */
export async function signInAsMember(page: Page): Promise<void> {
  await signIn(page, 'BRUCE7', 'bruce123');
  await expect(page).toHaveURL(/\/app$/);
}
