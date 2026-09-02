import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { qaBaseUrl, qaEnv } from './env';

export const ENV = qaEnv();
export const BASE = qaBaseUrl(ENV);
export const SHOTS = resolve(process.cwd(), 'test-results/qa');
mkdirSync(SHOTS, { recursive: true });

/** Um registro por página: erros não tratados e tudo que o console cospe como erro/aviso. */
export type ConsoleLog = { label: string; entries: string[] };
const logs: ConsoleLog[] = [];

export function watchConsole(page: Page, label: string): ConsoleLog {
  const log: ConsoleLog = { label, entries: [] };
  logs.push(log);
  const at = (): string => new Date().toISOString().slice(11, 19);
  page.on('pageerror', (error) => log.entries.push(`${at()} pageerror: ${error.message}`));
  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') return;
    log.entries.push(`${at()} ${type}: ${message.text()}`);
  });
  return log;
}

/** Grava o consolidado do console em `test-results/qa/console-<suite>.txt`. */
export function flushConsole(suite: string): string[] {
  const lines = logs.flatMap((log) => log.entries.map((entry) => `[${log.label}] ${entry}`));
  writeFileSync(resolve(SHOTS, `console-${suite}.txt`), lines.join('\n') + '\n');
  logs.length = 0;
  return lines;
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: false });
}

export async function newUser(
  browser: Browser,
  label: string,
  options: Parameters<Browser['newContext']>[0] = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
    permissions: ['microphone'],
    ...options,
  });
  const page = await context.newPage();
  watchConsole(page, label);
  return { context, page };
}

export async function typeCode(page: Page, code: string): Promise<void> {
  await page.getByLabel('Caractere 1 de 6').click();
  await page.keyboard.type(code, { delay: 15 });
}

export async function signIn(page: Page, code: string, password: string): Promise<void> {
  await page.goto('/login');
  await typeCode(page, code);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/(onboarding|app)$/, { timeout: 15_000 });
}

/** PNG de verdade (screenshot da própria página), pequeno, que o `sharp` da API decodifica. */
export async function pngFixture(page: Page): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const buffer = await page.screenshot({ clip: { x: 0, y: 0, width: 96, height: 96 } });
  return { name: 'avatar.png', mimeType: 'image/png', buffer };
}

export async function onboard(page: Page, nickname: string, withPhoto: boolean): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding$/);
  if (withPhoto) {
    await page.getByLabel('Foto de perfil').setInputFiles(await pngFixture(page));
    await expect(page.getByAltText('Prévia da foto de perfil')).toBeVisible();
  }
  await page.getByLabel('Nick').fill(nickname);
  await page.getByRole('button', { name: 'Entrar no King DC' }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
}

export type Me = { id: string; code: string; nickname: string | null; avatarUrl: string | null; isAdmin: boolean };

export async function me(context: BrowserContext): Promise<Me> {
  const response = await context.request.get(`${BASE}/api/me`);
  expect(response.status(), 'GET /api/me').toBe(200);
  return (await response.json()) as Me;
}

export async function meStatus(context: BrowserContext): Promise<number> {
  try {
    return (await context.request.get(`${BASE}/api/me`)).status();
  } catch {
    // Conexão keep-alive fechada pelo servidor entre dois pedidos: tenta uma vez mais.
    return (await context.request.get(`${BASE}/api/me`)).status();
  }
}

/** Espera o canal esvaziar no LiveKit: participantes de um run anterior demoram a sumir. */
export async function waitEmpty(context: BrowserContext, slug: string): Promise<void> {
  await expect
    .poll(async () => presence(context).then((p) => p.channels.find((c) => c.slug === slug)?.participants.length), {
      timeout: 90_000,
      intervals: [2000],
    })
    .toBe(0);
}

/** `true` quando há pelo menos `count` elementos de áudio e todos estão no volume dado. */
export async function audioAllAt(page: Page, volume: number, count: number): Promise<boolean> {
  const volumes = await page.evaluate(() => [...document.querySelectorAll('audio')].map((el) => el.volume));
  return volumes.length >= count && volumes.every((value) => value === volume);
}

export type Presence = {
  channels: { slug: string; participants: { userId: string; nickname: string; micMuted: boolean; screenSharing: boolean }[] }[];
  onlineCount: number;
};

export async function presence(context: BrowserContext): Promise<Presence> {
  const response = await context.request.get(`${BASE}/api/channels`);
  expect(response.status(), 'GET /api/channels').toBe(200);
  return (await response.json()) as Presence;
}

/** Admin do seed: no primeiro run passa pelo onboarding com foto; depois já cai no app. */
export async function signInAdmin(page: Page, nickname: string): Promise<void> {
  await signIn(page, ENV.SEED_ADMIN_CODE, ENV.SEED_ADMIN_PASSWORD);
  if (/\/onboarding$/.test(page.url())) await onboard(page, nickname, true);
}

export async function createInvite(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Convidar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Convidar alguém' });
  await dialog.getByRole('button', { name: 'Gerar convite' }).click();
  const code = (await dialog.getByLabel(/^Código de convite/).textContent()) ?? '';
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await expect(dialog).toBeHidden();
  expect(code).toHaveLength(6);
  return code;
}

export async function openChannel(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('link', { name }).click();
}

export async function joinCall(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Entrar no canal' }).click();
  await expect(page.getByTestId('control-mic')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible({ timeout: 30_000 });
}

export function tile(page: Page, userId: string) {
  return page.locator(`[data-identity="${userId}"]`);
}

export async function leaveCall(page: Page): Promise<void> {
  await page.getByTestId('control-leave').click();
  await expect(page.getByRole('button', { name: 'Entrar no canal' })).toBeVisible({ timeout: 15_000 });
}

/** Botões sem texto e sem `aria-label`: acessibilidade mínima do item 16. */
export async function unlabeledButtons(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((button) => button.textContent.trim() === '' && !button.getAttribute('aria-label'))
      .map((button) => button.outerHTML.slice(0, 120)),
  );
}

export async function horizontalScroll(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

export function stamp(): string {
  return Date.now().toString(36).slice(-5);
}

/** Anotação no relatório do runner (o lint barra `console.log`). */
export function note(message: string): void {
  process.stdout.write(`    · ${new Date().toISOString().slice(11, 19)} ${message}\n`);
}
