import { TrackSource } from 'livekit-server-sdk';
import type { ParticipantInfo } from 'livekit-server-sdk';
import { z } from 'zod';
import { DEAFENED_ATTRIBUTE, DEAFENED_ON, PRESENCE_CACHE_MS } from '@kingdc/contracts';
import type { PresenceParticipant } from '@kingdc/contracts';

type CacheEntry = {
  participants: PresenceParticipant[];
  fetchedAt: number;
  /** Última atualização em background falhou: o valor servido pode estar velho. */
  failed: boolean;
};

export type PresenceLookup = { participants: PresenceParticipant[]; fresh: boolean; failed: boolean };

/**
 * Cache de presença de 2 s (decisão D5), *stale-while-revalidate* na expiração por tempo:
 * entrada vencida não some, é servida na hora enquanto uma atualização roda em background
 * (uma por canal, sem empilhar). Um `Map` só, na memória do processo: presença nunca vai
 * para o Postgres. O webhook do LiveKit chama `forget()`, que apaga a entrada: aí o próximo
 * `GET /channels` bloqueia e busca fresco, porque o LiveKit acabou de dizer que mudou.
 */
export class PresenceCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #refreshing = new Set<string>();
  /** Quantas vezes cada canal já foi esquecido; corta atualização em voo que ficou velha. */
  readonly #epochs = new Map<string, number>();
  readonly #ttlMs: number;

  constructor(ttlMs: number = PRESENCE_CACHE_MS) {
    this.#ttlMs = ttlMs;
  }

  /** Devolve `null` só quando nunca houve entrada; vencida vem com `fresh: false`. */
  peek(slug: string): PresenceLookup | null {
    const entry = this.#entries.get(slug);
    if (entry === undefined) return null;
    return {
      participants: entry.participants,
      fresh: Date.now() - entry.fetchedAt < this.#ttlMs,
      failed: entry.failed,
    };
  }

  set(slug: string, participants: PresenceParticipant[]): void {
    this.#entries.set(slug, { participants, fetchedAt: Date.now(), failed: false });
  }

  /** Marca que a atualização em background falhou; o valor antigo continua servido. */
  markFailed(slug: string): void {
    const entry = this.#entries.get(slug);
    if (entry !== undefined) entry.failed = true;
  }

  /** Apaga a entrada de um canal: o próximo polling bloqueia e busca fresco. */
  forget(slug: string): void {
    this.#entries.delete(slug);
    this.#epochs.set(slug, (this.#epochs.get(slug) ?? 0) + 1);
  }

  /** Esquece tudo: webhook sem nome de sala e reset de estado entre testes. */
  clear(): void {
    for (const slug of [...this.#entries.keys()]) this.forget(slug);
  }

  /**
   * Roda `task` em background uma vez por canal: chamadas enquanto a anterior ainda corre
   * são ignoradas. Sucesso grava no cache; falha só marca a entrada. Um `forget()` no meio
   * do caminho descarta o resultado: ele já nasceu velho.
   */
  refreshInBackground(
    slug: string,
    task: () => Promise<PresenceParticipant[]>,
    onError: (error: unknown) => void,
  ): void {
    if (this.#refreshing.has(slug)) return;
    this.#refreshing.add(slug);
    const epoch = this.#epochs.get(slug) ?? 0;
    task()
      .then((participants) => {
        if ((this.#epochs.get(slug) ?? 0) === epoch) this.set(slug, participants);
      })
      .catch((error: unknown) => {
        this.markFailed(slug);
        onError(error);
      })
      .finally(() => this.#refreshing.delete(slug));
  }
}

/** O que o token põe em `metadata` (decisão D6). Vem do LiveKit, então nada é garantido. */
const metadataSchema = z.object({
  nickname: z.string().optional(),
  avatarUrl: z.string().nullish(),
});

function parseMetadata(raw: string): { nickname?: string; avatarUrl: string | null } {
  if (raw.length === 0) return { avatarUrl: null };
  try {
    const parsed = metadataSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { avatarUrl: null };
    const { nickname, avatarUrl } = parsed.data;
    if (nickname === undefined) return { avatarUrl: avatarUrl ?? null };
    return { nickname, avatarUrl: avatarUrl ?? null };
  } catch {
    return { avatarUrl: null };
  }
}

/**
 * `micMuted` = track de microfone ausente ou mutada; `deafened` = atributo publicado pelo
 * front; `screenSharing` = existe track de tela.
 */
export function toPresenceParticipant(info: ParticipantInfo): PresenceParticipant {
  const meta = parseMetadata(info.metadata);
  const micLive = info.tracks.some(
    (track) => track.source === TrackSource.MICROPHONE && !track.muted,
  );
  return {
    userId: info.identity,
    nickname: meta.nickname ?? (info.name.length > 0 ? info.name : info.identity),
    avatarUrl: meta.avatarUrl,
    micMuted: !micLive,
    deafened: info.attributes[DEAFENED_ATTRIBUTE] === DEAFENED_ON,
    screenSharing: info.tracks.some((track) => track.source === TrackSource.SCREEN_SHARE),
  };
}
