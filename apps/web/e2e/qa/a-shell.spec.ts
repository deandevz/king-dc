import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { QA_REAL } from './env';
import {
  createInvite,
  flushConsole,
  note,
  horizontalScroll,
  joinCall,
  leaveCall,
  me,
  meStatus,
  newUser,
  onboard,
  openChannel,
  presence,
  shot,
  signIn,
  signInAdmin,
  stamp,
  tile,
  unlabeledButtons,
  waitEmpty,
} from './harness';
import type { Me } from './harness';

/**
 * @qa-real — shell contra a stack real (docker compose) e o LiveKit Cloud, com 2 usuários
 * em 2 contexts. Itens 1, 2, 3, 9, 12, 13, 15 e 16 do roteiro do Q2.
 */
test.describe('@qa-real shell', () => {
  test.skip(!QA_REAL, 'QA_REAL=1 ausente: QA contra a stack real pulado');
  test.describe.configure({ mode: 'serial' });

  const run = stamp();
  let a: { context: BrowserContext; page: Page };
  let b: { context: BrowserContext; page: Page };
  let admin: Me;
  let adminNick = '';
  let guest: Me;

  test.beforeAll(async ({ browser }) => {
    a = await newUser(browser, 'A/admin');
    b = await newUser(browser, 'B/guest');
  });

  test.beforeEach(() => note(`início: ${test.info().title}`));

  test.afterAll(async () => {
    await a.context.close();
    await b.context.close();
    const lines = flushConsole('shell');
    note(`console (shell): ${lines.length} entradas`);
    for (const line of lines) note('  ' + line);
  });

  test('1. admin faz login, onboarding com PNG real, gera convite; convidado entra', async () => {
    await a.page.goto('/login');
    await shot(a.page, '01-login');
    await signInAdmin(a.page, `adm-${run}`);
    admin = await me(a.context);
    adminNick = admin.nickname ?? '';
    expect(admin.isAdmin).toBe(true);
    await waitEmpty(a.context, 'geral');
    expect(admin.avatarUrl, 'admin tem foto real depois do onboarding').toMatch(/^\/avatars\/.+\.webp\?v=\d+$/);

    const code = await createInvite(a.page);

    await signIn(b.page, code, `senha-${run}-123`);
    await expect(b.page).toHaveURL(/\/onboarding$/);
    await shot(b.page, '02-onboarding');
    await onboard(b.page, `guest-${run}`, false);
    guest = await me(b.context);
    expect(guest.nickname).toBe(`guest-${run}`);
    expect(guest.avatarUrl).toBeNull();
  });

  test('1b. ambos entram em Geral e cada um vê o tile do outro com nick e avatar', async () => {
    await openChannel(a.page, /Geral/);
    await joinCall(a.page);
    await openChannel(b.page, /Geral/);
    await expect(tile(b.page, admin.id)).toBeHidden();
    // Sala de espera do B mostra o A já dentro (presença da API). Contagem exata não vale:
    // participantes de um run anterior levam alguns segundos para sumir do LiveKit.
    await expect(b.page.getByText(/pessoas? na sala/)).toBeVisible({ timeout: 15_000 });
    await expect(b.page.locator('li:not(aside li)', { hasText: adminNick })).toBeVisible({ timeout: 15_000 });
    await shot(b.page, '03-main-waiting');
    await joinCall(b.page);

    const adminSeenByGuest = tile(b.page, admin.id);
    const guestSeenByAdmin = tile(a.page, guest.id);
    await expect(adminSeenByGuest).toBeVisible({ timeout: 20_000 });
    await expect(adminSeenByGuest).toContainText(adminNick);
    await expect(guestSeenByAdmin).toBeVisible({ timeout: 20_000 });
    await expect(guestSeenByAdmin).toContainText(`guest-${run}`);

    const src = await adminSeenByGuest.locator('img').getAttribute('src');
    expect(src, 'avatar do admin no tile do B é a foto real com ?v=').toMatch(/\/avatars\/.+\.webp\?v=\d+/);
    await expect(guestSeenByAdmin.locator('img')).toHaveCount(0);

    // Sidebar dos dois: fotos e nicks.
    const sidebarImg = b.page.locator('aside img[src*="/avatars/"]');
    await expect(sidebarImg.first()).toBeVisible({ timeout: 15_000 });
    await shot(a.page, '04-call-two-tiles');
  });

  test('9. avatar sem foto: gradiente igual nos 2 contexts para o mesmo usuário', async () => {
    const fromA = await tile(a.page, guest.id).locator('span[style]').first().getAttribute('style');
    const fromB = await tile(b.page, guest.id).locator('span[style]').first().getAttribute('style');
    const pick = (style: string | null): string => /var\(--kd-avatar-\d\)/.exec(style ?? '')?.[0] ?? 'none';
    expect(pick(fromA)).toMatch(/--kd-avatar-\d/);
    expect(pick(fromA)).toBe(pick(fromB));
  });

  test('12. trocar de canal conectado reflete na presença dos 2 contexts em ≤ 10 s', async () => {
    await openChannel(a.page, /Jogos/);
    await expect(a.page).toHaveURL(/\/app\/c\/jogos$/);
    await expect(a.page.getByText('Jogos · conectado')).toBeVisible({ timeout: 30_000 });

    const started = Date.now();
    const jogosRowB = b.page.locator('aside li', { hasText: 'Jogos' }).first();
    await expect(jogosRowB).toContainText(adminNick, { timeout: 10_000 });
    const geralRowB = b.page.locator('aside li', { hasText: 'Geral' }).first();
    await expect(geralRowB).not.toContainText(adminNick, { timeout: 10_000 });
    note(`presença refletiu em ${Date.now() - started} ms no B`);

    const jogosRowA = a.page.locator('aside li', { hasText: 'Jogos' }).first();
    await expect(jogosRowA).toContainText(adminNick, { timeout: 10_000 });
    await expect(tile(b.page, admin.id)).toBeHidden({ timeout: 30_000 });

    const seen = await presence(b.context);
    const inGeral = seen.channels.find((c) => c.slug === 'geral')?.participants.map((p) => p.userId) ?? [];
    expect(inGeral, 'API não lista mais o admin em geral').not.toContain(admin.id);

    await openChannel(a.page, /Geral/);
    await expect(a.page.getByText('Geral · conectado')).toBeVisible({ timeout: 30_000 });
    await expect(tile(b.page, admin.id)).toBeVisible({ timeout: 30_000 });
  });

  test('3. F5 no meio da call', async () => {
    await a.page.reload();
    await expect(a.page).toHaveURL(/\/app\/c\/geral$/);
    const joinButton = a.page.getByRole('button', { name: 'Entrar no canal' });
    await expect(joinButton).toBeVisible({ timeout: 20_000 });
    await expect(a.page.getByTestId('control-mic')).toBeHidden();

    const started = Date.now();
    await expect(tile(b.page, admin.id)).toBeHidden({ timeout: 60_000 });
    note(`tile do A sumiu para o B ${Date.now() - started} ms depois do F5`);
    await shot(a.page, '05-after-f5');

    await joinCall(a.page);
    await expect(tile(b.page, admin.id)).toBeVisible({ timeout: 30_000 });
    await expect(tile(a.page, guest.id)).toBeVisible({ timeout: 30_000 });
  });

  test('2/8. screenshots 1440×900, viewport 1279×800 e 1920×1080', async () => {
    await a.page.goto('/app/c/geral?settings=1');
    await expect(a.page.getByRole('dialog', { name: 'Configurações' })).toBeVisible();
    await shot(a.page, '06-settings');
    await a.page.keyboard.press('Escape');

    await a.page.setViewportSize({ width: 1279, height: 800 });
    await a.page.waitForTimeout(300);
    const small = await horizontalScroll(a.page);
    expect(small.scrollWidth, 'D19: abaixo de 1280 aparece scroll horizontal').toBeGreaterThan(small.clientWidth);
    await shot(a.page, '07-viewport-1279');
    await expect(a.page.locator('aside')).toBeVisible();

    await a.page.setViewportSize({ width: 1920, height: 1080 });
    await a.page.waitForTimeout(300);
    const large = await horizontalScroll(a.page);
    expect(large.scrollWidth).toBeLessThanOrEqual(large.clientWidth);
    await shot(a.page, '08-viewport-1920');
    await a.page.setViewportSize({ width: 1440, height: 900 });
  });

  test('16. botões de ícone têm aria-label; Tab no login passa pelas 6 caixas', async ({ browser }) => {
    const states = ['/app/c/geral', '/app/c/geral?settings=1'];
    for (const path of states) {
      await a.page.goto(path);
      await a.page.waitForTimeout(500);
      expect(await unlabeledButtons(a.page), `botões sem label em ${path}`).toEqual([]);
    }
    await a.page.goto('/app/c/geral');

    const fresh = await newUser(browser, 'tab-login');
    await fresh.page.goto('/login');
    expect(await unlabeledButtons(fresh.page)).toEqual([]);
    const focused: string[] = [];
    await fresh.page.getByLabel('Caractere 1 de 6').focus();
    for (let index = 0; index < 8; index += 1) {
      focused.push(
        await fresh.page.evaluate(
          () => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.id ?? '?',
        ),
      );
      await fresh.page.keyboard.press('Tab');
    }
    expect(focused.slice(0, 6)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Caractere ${n} de 6`));
    note(`ordem de Tab no login: ${focused.join(' → ')}`);
    await fresh.context.close();
  });

  test('13. sair da conta num context: o outro continua; a sessão do primeiro morre', async () => {
    // B nunca saiu da call de Geral; A já saiu (as navegações completas de cima derrubam a sala).
    await expect(b.page.getByTestId('control-mic')).toBeVisible();

    await a.page.goto('/app/c/geral?settings=1');
    await a.page.getByRole('button', { name: 'Sair da conta' }).click();
    await a.page.getByRole('dialog', { name: 'Sair da conta' }).getByRole('button', { name: 'Sair da conta' }).click();
    await expect(a.page).toHaveURL(/\/login$/, { timeout: 15_000 });
    expect(await meStatus(a.context), '/api/me do A depois do logout').toBe(401);

    await b.page.waitForTimeout(6000);
    expect(await meStatus(b.context), '/api/me do B continua').toBe(200);
    await expect(b.page.getByTestId('control-mic')).toBeVisible();
    await expect(b.page.getByText('Geral · conectado')).toBeVisible();
    await leaveCall(b.page);
  });
});
