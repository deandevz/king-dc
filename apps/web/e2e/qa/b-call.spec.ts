import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { QA_REAL } from './env';
import {
  audioAllAt,
  BASE,
  createInvite,
  flushConsole,
  note,
  joinCall,
  leaveCall,
  me,
  newUser,
  onboard,
  openChannel,
  shot,
  signIn,
  signInAdmin,
  stamp,
  tile,
  waitEmpty,
  watchConsole,
} from './harness';
import type { Me } from './harness';

/**
 * @qa-real — sala contra o LiveKit Cloud com 3 usuários. Itens 5, 6, 7, 10, 11 e 14.
 * Roda depois de `a-shell.spec.ts` (o admin já tem nick); cria os convidados na hora.
 */
const ROOT = resolve(process.cwd(), '../..');
const FAKE_MEDIA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];

async function focusedLabel(page: Page): Promise<string> {
  return page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? '?',
  );
}

async function inviteGuest(admin: Page, browser: Browser, label: string, nick: string) {
  const code = await createInvite(admin);
  const user = await newUser(browser, label);
  await signIn(user.page, code, `senha-${nick}-123`);
  await onboard(user.page, nick, false);
  return { ...user, me: await me(user.context) };
}

test.describe('@qa-real sala', () => {
  test.skip(!QA_REAL, 'QA_REAL=1 ausente: QA contra a stack real pulado');
  test.describe.configure({ mode: 'serial' });

  const run = stamp();
  let a: { context: BrowserContext; page: Page };
  let b: { context: BrowserContext; page: Page; me: Me };
  let c: { context: BrowserContext; page: Page; me: Me };
  let admin: Me;
  let adminNick = '';

  test.beforeAll(async ({ browser }) => {
    a = await newUser(browser, 'A/admin');
    await signInAdmin(a.page, `adm-${run}`);
    admin = await me(a.context);
    adminNick = admin.nickname ?? '';
    await waitEmpty(a.context, 'geral');
    b = await inviteGuest(a.page, browser, 'B', `b-${run}`);
    c = await inviteGuest(a.page, browser, 'C', `c-${run}`);
  });

  test.beforeEach(() => note(`início: ${test.info().title}`));

  test.afterAll(async () => {
    await a.context.close();
    await b.context.close();
    await c.context.close();
    const lines = flushConsole('call');
    note(`console (call): ${lines.length} entradas`);
    for (const line of lines) note('  ' + line);
  });

  test('5. deaf: A ensurdece, C entra depois, A não ouve C; desensurdecer mantém o mic mudo', async () => {
    await openChannel(a.page, /Geral/);
    await joinCall(a.page);
    await openChannel(b.page, /Geral/);
    await joinCall(b.page);
    await expect(tile(a.page, b.me.id)).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => audioAllAt(a.page, 1, 1), { timeout: 20_000 }).toBe(true);

    await a.page.getByTestId('control-deaf').click();
    await expect(a.page.getByTestId('control-deaf')).toHaveAttribute('aria-pressed', 'true');
    await expect(a.page.getByTestId('control-mic')).toHaveAttribute('aria-pressed', 'false');
    await expect(tile(a.page, admin.id)).toHaveAttribute('data-muted', 'true', { timeout: 10_000 });
    await expect.poll(() => audioAllAt(a.page, 0, 1)).toBe(true);

    await openChannel(c.page, /Geral/);
    await joinCall(c.page);
    await expect(tile(a.page, c.me.id)).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => audioAllAt(a.page, 0, 2), { timeout: 20_000 }).toBe(true);
    await shot(a.page, '09-deaf-three');

    await a.page.getByTestId('control-deaf').click();
    await expect(a.page.getByTestId('control-deaf')).toHaveAttribute('aria-pressed', 'false');
    await expect(a.page.getByTestId('control-mic')).toHaveAttribute('aria-pressed', 'false');
    await expect(tile(a.page, admin.id)).toHaveAttribute('data-muted', 'true');
    await expect.poll(() => audioAllAt(a.page, 1, 2)).toBe(true);
    await a.page.getByTestId('control-mic').click();
    await expect(tile(b.page, admin.id)).toHaveAttribute('data-muted', 'false', { timeout: 10_000 });
  });

  test('7. ESC com input focado fecha o modal e devolve o foco ao botão que abriu', async () => {
    await a.page.getByTestId('control-settings').click();
    const dialog = a.page.getByRole('dialog', { name: 'Configurações' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Nick').focus();
    await a.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await focusedLabel(a.page), 'foco volta ao botão da barra').toBe('Configurações');
    await expect(a.page.getByTestId('control-mic')).toBeVisible();

    // Modal de convite depois de vários ciclos de polling (2 s): o foco continua no botão.
    await a.page.getByRole('button', { name: 'Convidar' }).click();
    const invite = a.page.getByRole('dialog', { name: 'Convidar alguém' });
    await invite.getByRole('button', { name: 'Gerar convite' }).focus();
    await a.page.waitForTimeout(6500);
    expect(await focusedLabel(a.page), 'foco no botão do modal sobrevive ao polling').toBe('BUTTON');
    await a.page.keyboard.press('Escape');
    await expect(invite).toBeHidden();
    expect(await focusedLabel(a.page)).toBe('BUTTON');
  });

  test('6. push-to-talk: segurar liga, soltar/blur/aba escondida desligam; ESC no campo da tecla', async () => {
    await a.page.getByTestId('control-settings').click();
    const dialog = a.page.getByRole('dialog', { name: 'Configurações' });
    await dialog.getByRole('radio', { name: 'Apertar pra falar' }).click();
    await expect(dialog.getByLabel('Tecla')).toHaveValue('`');
    await dialog.getByLabel('Tecla').focus();
    await a.page.keyboard.press('Escape');
    const pttKey = await a.page.evaluate(() => JSON.parse(localStorage.getItem('kingdc.audio') ?? '{}').pttKey);
    expect(pttKey, 'ESC no campo da tecla não vira a tecla do PTT').toBe('Backquote');
    if (await dialog.isVisible()) await a.page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const local = tile(a.page, admin.id);
    await expect(local).toHaveAttribute('data-muted', 'true', { timeout: 10_000 });
    await a.page.keyboard.down('Backquote');
    await expect(local).toHaveAttribute('data-muted', 'false', { timeout: 10_000 });
    await expect(tile(b.page, admin.id)).toHaveAttribute('data-muted', 'false', { timeout: 10_000 });
    await a.page.keyboard.up('Backquote');
    await expect(local).toHaveAttribute('data-muted', 'true', { timeout: 10_000 });

    await a.page.keyboard.down('Backquote');
    await expect(local).toHaveAttribute('data-muted', 'false', { timeout: 10_000 });
    await a.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(local).toHaveAttribute('data-muted', 'true', { timeout: 10_000 });
    await a.page.keyboard.up('Backquote');

    await a.page.keyboard.down('Backquote');
    await expect(local).toHaveAttribute('data-muted', 'false', { timeout: 10_000 });
    await a.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(local).toHaveAttribute('data-muted', 'true', { timeout: 10_000 });
    await a.page.keyboard.up('Backquote');
    await a.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    });
    await shot(a.page, '10-ptt');
    await a.page.evaluate(() => localStorage.removeItem('kingdc.audio'));
  });

  test('11. compartilhar tela: B vê foco, chip e miniaturas; parar e sair voltam à grade', async () => {
    await a.page.getByTestId('control-share').click();
    await expect(a.page.getByTestId('control-share')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
    await expect(b.page.getByText(`${adminNick} está compartilhando a tela`)).toBeVisible({ timeout: 20_000 });
    const video = b.page.locator('video');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.videoWidth), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(b.page.locator('[data-identity]')).toHaveCount(3);
    await expect(b.page.locator('[data-identity]').first().locator('img, span').first()).toBeVisible();
    const stripHeight = await tile(b.page, admin.id).evaluate((el) => el.getBoundingClientRect().height);
    note(`miniatura na faixa: ${stripHeight}px de altura`);
    await expect(tile(b.page, admin.id)).toHaveAttribute('data-sharing', 'true');
    await shot(b.page, '11-share-focus');
    await shot(a.page, '11-share-local');

    await a.page.getByTestId('control-share').click();
    await expect(a.page.getByTestId('control-share')).toHaveAttribute('aria-pressed', 'false', { timeout: 20_000 });
    await expect(b.page.locator('video')).toHaveCount(0, { timeout: 20_000 });
    await expect(b.page.getByText(/está compartilhando a tela/)).toBeHidden();

    await a.page.getByTestId('control-share').click();
    await expect(b.page.locator('video')).toBeVisible({ timeout: 20_000 });
    await leaveCall(a.page);
    await expect(b.page.locator('video')).toHaveCount(0, { timeout: 30_000 });
    await expect(b.page.getByText(/está compartilhando a tela/)).toBeHidden();
    await expect(b.page.locator('[data-identity]')).toHaveCount(2, { timeout: 30_000 });
    await shot(b.page, '12-share-after-leave');
  });

  test('10. autoplay bloqueado: context sem gesto vê "Clique para ativar o áudio"', async () => {
    const strict = await chromium.launch({
      args: [...FAKE_MEDIA, '--autoplay-policy=user-gesture-required'],
      ignoreDefaultArgs: ['--autoplay-policy=no-user-gesture-required'],
    });
    const context = await strict.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 }, permissions: ['microphone'] });
    await context.addCookies(await a.context.cookies());
    // Em "detecção de voz" o microfone é capturado ao entrar, e o Chromium libera autoplay para
    // página que já captura áudio: o aviso só aparece de verdade em push-to-talk (sem captura).
    await context.addInitScript(() => {
      localStorage.setItem(
        'kingdc.audio',
        JSON.stringify({ inputDeviceId: null, outputDeviceId: null, outputVolume: 1, inputMode: 'ptt', pttKey: 'Backquote' }),
      );
    });
    // `page.evaluate` e `locator.evaluate` rodam com `userGesture: true` no CDP e dão ativação
    // à página; o clique de entrada vem de um init script, sem gesto, e nada é avaliado antes
    // de o aviso aparecer.
    await context.addInitScript(() => {
      const timer = setInterval(() => {
        const button = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Entrar no canal'));
        if (button === undefined) return;
        clearInterval(timer);
        button.click();
      }, 200);
    });
    const page = await context.newPage();
    watchConsole(page, 'A/no-gesture');
    await page.goto('/app/c/geral');
    // Nenhuma chamada do Playwright à página antes de o áudio remoto tentar tocar: até o
    // polling de uma asserção passa por `callFunctionOn` com gesto e libera o autoplay.
    await new Promise((resolve) => setTimeout(resolve, 12_000));
    await expect(page.getByText('Clique para ativar o áudio')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('control-mic')).toBeVisible();
    await shot(page, '13-autoplay-gate');
    await page.getByRole('button', { name: 'Ativar áudio' }).click();
    await expect(page.getByText('Clique para ativar o áudio')).toBeHidden({ timeout: 10_000 });
    await expect.poll(() => audioAllAt(page, 1, 2)).toBe(true);
    await context.close();
    await strict.close();
  });

  test('14. API derrubada: toast, app inteiro, presença; sobe de novo e recupera sem F5', async () => {
    await expect(b.page.getByTestId('control-mic')).toBeVisible();
    execSync('docker compose stop api', { cwd: ROOT, stdio: 'ignore' });
    try {
      await expect(b.page.locator('[role="status"]').filter({ hasText: /servidor|conexão/i })).toBeVisible({ timeout: 20_000 });
      await shot(b.page, '14-api-down');
      await expect(b.page.locator('aside')).toBeVisible();
      await expect(b.page.getByTestId('control-mic')).toBeVisible();
      const staleNote = await b.page.getByText('Presença pode estar desatualizada.').isVisible();
      note(`aviso de presença velha com API fora: ${staleNote}`);
      expect(await b.page.locator('aside li').filter({ hasText: 'Geral' }).first().textContent()).toContain(`b-${run}`);
    } finally {
      execSync('docker compose start api', { cwd: ROOT, stdio: 'ignore' });
    }
    await expect(c.page.getByTestId('control-mic')).toBeVisible();
    await c.page.getByTestId('control-leave').click();
    const geralRowB = b.page.locator('aside li').filter({ hasText: 'Geral' }).first();
    await expect(geralRowB).not.toContainText(`c-${run}`, { timeout: 60_000 });
    await expect(b.page.locator('[role="status"]').filter({ hasText: /servidor|conexão/i })).toBeHidden({ timeout: 60_000 });
    await shot(b.page, '15-api-back');
    await leaveCall(b.page);
  });
});
