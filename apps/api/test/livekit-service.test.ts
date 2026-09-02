import { RoomServiceClient, ServerError } from 'livekit-server-sdk';
import { expect, test, vi } from 'vitest';
import { LIST_PARTICIPANTS_TIMEOUT_MS, createLiveKitService } from '../src/lib/livekit.js';

const config = {
  url: 'wss://livekit.test',
  hostHttp: 'http://livekit.test',
  apiKey: 'test-key',
  apiSecret: 'test-secret-com-tamanho-suficiente',
};

/**
 * O LiveKit Cloud responde `404 not_found` quando a sala ainda não existe, e como ela só
 * nasce no primeiro join (D7) esse é o estado normal de canal vazio. Confirmado à mão
 * contra o LiveKit Cloud em 2026-09-01.
 */
test('sala que ainda não existe vira lista vazia, não erro', async () => {
  const notFound = new ServerError('Not Found', 'requested room does not exist', 404, 'not_found');
  const spy = vi.spyOn(RoomServiceClient.prototype, 'listParticipants').mockRejectedValue(notFound);

  try {
    await expect(createLiveKitService(config).listParticipants('geral')).resolves.toEqual([]);
  } finally {
    spy.mockRestore();
  }
});

test('erro de verdade do LiveKit continua subindo para virar presença stale', async () => {
  const outage = new ServerError('Internal', 'upstream indisponível', 503, 'internal');
  const spy = vi.spyOn(RoomServiceClient.prototype, 'listParticipants').mockRejectedValue(outage);

  try {
    await expect(createLiveKitService(config).listParticipants('geral')).rejects.toThrow(
      'upstream indisponível',
    );
  } finally {
    spy.mockRestore();
  }
});

test('listParticipants desiste depois de 3 s se o LiveKit aceitar e nunca responder', async () => {
  vi.useFakeTimers();
  const spy = vi
    .spyOn(RoomServiceClient.prototype, 'listParticipants')
    .mockReturnValue(new Promise(() => undefined));

  try {
    const pending = createLiveKitService(config).listParticipants('geral');
    const outcome = expect(pending).rejects.toThrow('LiveKit não respondeu em 3000 ms (geral)');
    await vi.advanceTimersByTimeAsync(LIST_PARTICIPANTS_TIMEOUT_MS);
    await outcome;
  } finally {
    spy.mockRestore();
    vi.useRealTimers();
  }
});
