import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { hasLiveKit, livekitEnv } from './livekitEnv';

/**
 * E2E de verdade contra o LiveKit: dois browsers entram na mesma sala e conferem
 * presença, mudo, deaf e saída. Marcado `@livekit` porque consome minutos do plano —
 * sala curta, dois participantes.
 */

const env = livekitEnv();
const ROOM = `e2e-${Date.now()}`;

async function mintToken(identity: string, nickname: string): Promise<string> {
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name: nickname,
    metadata: JSON.stringify({ nickname, avatarUrl: null }),
    ttl: '10m',
  });
  token.addGrant({
    roomJoin: true,
    room: ROOM,
    canPublish: true,
    canPublishSources: [
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
    canSubscribe: true,
  });
  return token.toJwt();
}

async function join(browser: Browser, identity: string, nickname: string): Promise<Page> {
  const context = await browser.newContext({ permissions: ['microphone'] });
  const page = await context.newPage();
  const token = await mintToken(identity, nickname);
  const query = new URLSearchParams({ url: env.LIVEKIT_URL, token, nick: nickname });
  await page.goto(`/dev-call?${query.toString()}`);
  await expect(page.getByTestId('dev-connection')).toHaveText('connected', { timeout: 30_000 });
  return page;
}

test.describe('@livekit sala real', () => {
  test.skip(!hasLiveKit(env), 'chaves do LiveKit ausentes: e2e real da sala pulado');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('dois participantes se veem, mudo propaga, deaf é local e sair some da lista', async ({
    browser,
  }) => {
    const alice = await join(browser, 'e2e-a', 'alice');
    const bob = await join(browser, 'e2e-b', 'bob');

    const bobSeenByAlice = alice.locator('[data-identity="e2e-b"]');
    const aliceSeenByBob = bob.locator('[data-identity="e2e-a"]');
    await expect(bobSeenByAlice).toBeVisible({ timeout: 20_000 });
    await expect(bobSeenByAlice).toContainText('bob');
    await expect(aliceSeenByBob).toBeVisible({ timeout: 20_000 });
    await expect(aliceSeenByBob).toContainText('alice');
    await expect(alice.locator('[data-identity="e2e-a"]')).toContainText('você');

    // Alice muta: o mudo tem de chegar no tile que Bob vê.
    await expect(aliceSeenByBob).toHaveAttribute('data-muted', 'false', { timeout: 20_000 });
    await alice.getByTestId('control-mic').click();
    await expect(aliceSeenByBob).toHaveAttribute('data-muted', 'true', { timeout: 20_000 });

    // Ensurdecer muta o microfone de Alice junto (decisão D9).
    await alice.getByTestId('control-deaf').click();
    await expect(alice.getByTestId('control-deaf')).toHaveAttribute('aria-pressed', 'true');
    await expect(alice.getByTestId('control-mic')).toHaveAttribute('aria-pressed', 'false');

    await alice.getByTestId('control-leave').click();
    await expect(bob.locator('[data-identity]')).toHaveCount(1, { timeout: 30_000 });
    await expect(bob.locator('[data-identity="e2e-b"]')).toBeVisible();

    await alice.context().close();
    await bob.context().close();
  });
});
