import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { finishOnboarding, signIn, signInAsAdmin, signInAsMember } from './helpers';
import { hasLiveKit, livekitEnv } from './livekitEnv';

/** Entrar num canal conecta numa sala do LiveKit de verdade: sem chaves, não há o que testar. */
const LIVEKIT = hasLiveKit(livekitEnv());

/** A pílula de controles só existe dentro da call e é o sinal de que a sala montou. */
async function expectInCall(page: Page, dockStatus: string): Promise<void> {
  await expect(page.getByTestId('control-mic')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('control-deaf')).toBeVisible();
  await expect(page.getByTestId('control-share')).toBeVisible();
  await expect(page.getByTestId('control-leave')).toBeVisible();
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(dockStatus)).toBeVisible({ timeout: 30_000 });
  // A sala e a sala de espera dividem a rota: uma no ar quer dizer a outra fora.
  await expect(page.getByRole('button', { name: 'Entrar no canal' })).toBeHidden();
}

/** A linha de um canal na sidebar: o `li` que embrulha o link e a lista de presentes. */
function sidebarChannel(page: Page, name: RegExp): Locator {
  return page
    .getByRole('complementary')
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name }) });
}

/** PNG 1×1 transparente: serve só para o input de arquivo ter um arquivo real. */
const PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.beforeEach(async ({ request }) => {
  await request.post('/api/__reset');
});

test('o canal geral mostra os 4 presentes', async ({ page }) => {
  await signInAsMember(page);

  await page.getByRole('link', { name: /Geral/ }).click();
  await expect(page).toHaveURL(/\/app\/c\/geral$/);

  await expect(page.getByText('4 pessoas na sala · vitão está compartilhando a tela')).toBeVisible();
  for (const nick of ['lele', 'tonhão', 'duda', 'vitão']) {
    await expect(page.getByRole('listitem').filter({ hasText: nick }).first()).toBeVisible();
  }
});

test('canal vazio avisa que ninguém está lá', async ({ page }) => {
  await signInAsMember(page);

  await page.getByRole('link', { name: /Música/ }).click();
  await expect(page.getByText('Ninguém aqui ainda. Seja o primeiro a entrar.')).toBeVisible();
});

test('quem não é admin não vê o botão de convidar', async ({ page }) => {
  await signInAsMember(page);
  await expect(page.getByRole('button', { name: 'Convidar' })).toBeHidden();
});

test('as configurações abrem por ?settings=1 e fecham com ESC', async ({ page }) => {
  await signInAsMember(page);

  await page.goto('/app?settings=1');
  const dialog = page.getByRole('dialog', { name: 'Configurações' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Perfil e áudio')).toBeVisible();
  await expect(dialog.getByText('BRUCE7')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('o modo apertar pra falar avisa do foco da aba', async ({ page }) => {
  await signInAsMember(page);
  await page.goto('/app?settings=1');

  await page.getByRole('radio', { name: 'Apertar pra falar' }).click();
  await expect(
    page.getByText('O apertar pra falar só funciona com a aba do King DC em foco.'),
  ).toBeVisible();
  await expect(page.getByLabel('Tecla')).toHaveValue('`');
});

test('admin gera um convite de 6 caracteres', async ({ page }) => {
  await signInAsAdmin(page);

  await page.getByRole('button', { name: 'Convidar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Convidar alguém' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Gerar convite' }).click();
  const code = dialog.getByLabel(/^Código de convite/);
  await expect(code).toBeVisible();
  await expect(await code.textContent()).toHaveLength(6);
});

test('sair da conta pede confirmação e volta para o login', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/app?settings=1');

  await page.getByRole('button', { name: 'Sair da conta' }).click();
  const confirm = page.getByRole('dialog', { name: 'Sair da conta' });
  await expect(confirm).toBeVisible();

  await confirm.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('entrar no canal me põe na sidebar na hora e sair me tira', async ({ page }) => {
  await signInAsMember(page);
  await page.getByRole('link', { name: /Geral/ }).click();

  const geral = sidebarChannel(page, /Geral/);
  const mine = geral.getByText('você', { exact: true });
  await expect(mine).toHaveCount(0);

  // Sem esperar o polling: a shell me põe na lista assim que eu peço para entrar.
  await page.getByRole('button', { name: 'Entrar no canal' }).click();
  await expect(mine).toBeVisible({ timeout: 1000 });
  await expect(geral.getByText('bruce', { exact: true })).toBeVisible();

  await page.getByTestId('control-leave').click();
  await expect(mine).toHaveCount(0, { timeout: 1000 });
});

test.describe('@livekit sala do canal', () => {
  test.skip(!LIVEKIT, 'chaves do LiveKit ausentes: a sala real do canal não roda');
  test.describe.configure({ timeout: 120_000 });

  test('entrar no canal conecta na sala e sair volta para a espera', async ({ page }) => {
    await signInAsMember(page);

    await page.getByRole('link', { name: /Geral/ }).click();
    await page.getByRole('button', { name: 'Entrar no canal' }).click();
    await expectInCall(page, 'Geral · conectado');

    await page.getByTestId('control-leave').click();
    await expect(page.getByRole('button', { name: 'Entrar no canal' })).toBeVisible();
    await expect(page.getByTestId('control-mic')).toBeHidden();
  });

  test('quem entra aparece na sidebar do outro sem esperar o polling', async ({
    browser,
    baseURL,
  }) => {
    const options = { baseURL, viewport: { width: 1440, height: 900 } };
    const mine = await browser.newContext(options);
    const theirs = await browser.newContext(options);
    try {
      const [pageA, pageB] = [await mine.newPage(), await theirs.newPage()];
      await signInAsMember(pageA);
      await signIn(pageB, 'ADMKNG', 'admin123');
      await finishOnboarding(pageB, 'zezinho');

      for (const page of [pageA, pageB]) {
        await page.getByRole('link', { name: /Geral/ }).click();
        await page.getByRole('button', { name: 'Entrar no canal' }).click();
      }
      await expectInCall(pageA, 'Geral · conectado');
      await expectInCall(pageB, 'Geral · conectado');

      // O mock nunca devolve os dois em `GET /channels`: quem os põe lá é a sala do LiveKit.
      const seen = { timeout: 20_000 };
      await expect(sidebarChannel(pageA, /Geral/).getByText('zezinho', { exact: true })).toBeVisible(seen);
      await expect(sidebarChannel(pageB, /Geral/).getByText('bruce', { exact: true })).toBeVisible(seen);
    } finally {
      await mine.close();
      await theirs.close();
    }
  });

  test('trocar de canal na call sai de um e entra no outro', async ({ page }) => {
    await signInAsMember(page);

    await page.getByRole('link', { name: /Geral/ }).click();
    await page.getByRole('button', { name: 'Entrar no canal' }).click();
    await expectInCall(page, 'Geral · conectado');

    await page.getByRole('link', { name: /Jogos/ }).click();
    await expect(page).toHaveURL(/\/app\/c\/jogos$/);
    // A troca derruba a sala antiga: o badge some até a sala nova conectar.
    await expect(page.getByText('Geral · conectado')).toBeHidden();
    await expectInCall(page, 'Jogos · conectado');
  });
});

test('a foto escolhida no onboarding aparece na prévia', async ({ page }) => {
  await signIn(page, 'KNG742', 'convidado123');
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel('Foto de perfil').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PIXEL_PNG_BASE64, 'base64'),
  });

  await expect(page.getByAltText('Prévia da foto de perfil')).toBeVisible();
});

test('o modal segura o foco durante o polling e devolve ao botão que abriu', async ({ page }) => {
  await signInAsAdmin(page);

  const invite = page.getByRole('button', { name: 'Convidar' });
  await invite.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Convidar alguém' });
  await expect(dialog).toBeVisible();

  const generate = dialog.getByRole('button', { name: 'Gerar convite' });
  await generate.focus();
  // Vários ciclos de presença (2 s cada): o shell re-renderiza e o modal não pode roubar o foco.
  await page.waitForTimeout(6000);
  await expect(generate).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(invite).toBeFocused();
});

test('ESC no campo da tecla do PTT fecha o modal sem virar a tecla', async ({ page }) => {
  await signInAsMember(page);
  await page.goto('/app?settings=1');
  await page.getByRole('radio', { name: 'Apertar pra falar' }).click();

  const key = page.getByLabel('Tecla');
  await key.focus();
  await page.keyboard.press('KeyV');
  await expect(key).toHaveValue('V');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeHidden();
  await page.goto('/app?settings=1');
  await expect(page.getByLabel('Tecla')).toHaveValue('V');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kingdc.audio') ?? '{}'));
  expect(stored.pttKey).toBe('KeyV');
});

test('API fora do ar: toast uma vez só e presença marcada como desatualizada', async ({ page, request }) => {
  await signInAsMember(page);
  await page.getByRole('link', { name: /Geral/ }).click();
  await expect(page.getByText('4 pessoas na sala · vitão está compartilhando a tela')).toBeVisible();

  await request.post('/api/__outage', { data: { channels: true } });
  const toast = page.getByText('Deu ruim no servidor. Tente de novo.');
  const staleHint = page.getByText('Presença pode estar desatualizada.');
  await expect(toast).toBeVisible({ timeout: 10_000 });
  await expect(staleHint).toBeVisible();
  // A última presença boa continua na tela, só marcada como velha.
  await expect(page.getByText('4 pessoas na sala · vitão está compartilhando a tela')).toBeVisible();

  // O toast some sozinho em 6 s e os pollings seguintes (2 s) não o trazem de volta.
  await expect(toast).toBeHidden({ timeout: 10_000 });
  await page.waitForTimeout(6000);
  await expect(toast).toBeHidden();
  await expect(staleHint).toBeVisible();

  await request.post('/api/__outage', { data: { channels: false } });
  await expect(staleHint).toBeHidden({ timeout: 10_000 });
});
