import {
  AccessToken,
  RoomServiceClient,
  ServerError,
  TrackSource,
  WebhookReceiver,
} from 'livekit-server-sdk';
import type { ParticipantInfo, WebhookEvent } from 'livekit-server-sdk';
import { LIVEKIT_TOKEN_TTL_SECONDS } from '@kingdc/contracts';

export type CreateTokenInput = {
  /** Nome da sala no LiveKit; sempre o `slug` do canal (decisão D7). */
  room: string;
  /** `identity` do participante; sempre o `user.id` (decisão D6). */
  identity: string;
  name: string;
  /** JSON com `{ nickname, avatarUrl }` (decisão D6). */
  metadata: string;
  ttlSeconds?: number;
};

/**
 * Interface fina sobre o SDK do LiveKit. Existe para que as rotas dependam de um
 * contrato pequeno e testável, não do `RoomServiceClient` inteiro.
 */
export interface LiveKitService {
  /** URL pública (wss://) devolvida junto com o token. */
  readonly url: string;
  listParticipants(room: string): Promise<ParticipantInfo[]>;
  /** Troca o `metadata` de quem já está na sala, sem derrubar a conexão (decisão D6). */
  updateParticipantMetadata(room: string, identity: string, metadata: string): Promise<void>;
  createToken(input: CreateTokenInput): Promise<string>;
  verifyWebhook(rawBody: string, authHeader: string | undefined): Promise<WebhookEvent>;
}

export type LiveKitConfig = {
  url: string;
  hostHttp: string;
  apiKey: string;
  apiSecret: string;
};

/**
 * Teto de espera pelo `listParticipants`. Sem isso, um LiveKit que aceita a conexão e não
 * responde segura o `GET /channels` (e o polling de 2 s do front) por até 5 minutos.
 */
export const LIST_PARTICIPANTS_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`LiveKit não respondeu em ${ms} ms (${label})`));
    }, ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

class LiveKitSdkService implements LiveKitService {
  readonly url: string;

  readonly #rooms: RoomServiceClient;
  readonly #webhooks: WebhookReceiver;
  readonly #config: LiveKitConfig;

  constructor(config: LiveKitConfig) {
    this.url = config.url;
    this.#config = config;
    this.#rooms = new RoomServiceClient(config.hostHttp, config.apiKey, config.apiSecret);
    this.#webhooks = new WebhookReceiver(config.apiKey, config.apiSecret);
  }

  /**
   * Sala inexistente devolve lista vazia, não erro. O LiveKit Cloud responde
   * `404 not_found` para sala que ainda não nasceu — e como a sala só nasce no primeiro
   * join (D7), isso é o estado normal de todo canal vazio. Só erro de verdade sobe.
   */
  async listParticipants(room: string): Promise<ParticipantInfo[]> {
    try {
      return await withTimeout(
        this.#rooms.listParticipants(room),
        LIST_PARTICIPANTS_TIMEOUT_MS,
        room,
      );
    } catch (error) {
      if (error instanceof ServerError && error.status === 404) return [];
      throw error;
    }
  }

  /**
   * Usado quando a pessoa troca nick ou foto durante a call: o `metadata` viaja no token
   * (D6) e sem isso só mudaria no próximo join.
   */
  async updateParticipantMetadata(room: string, identity: string, metadata: string): Promise<void> {
    await withTimeout(
      this.#rooms.updateParticipant(room, identity, { metadata }),
      LIST_PARTICIPANTS_TIMEOUT_MS,
      room,
    );
  }

  createToken(input: CreateTokenInput): Promise<string> {
    const token = new AccessToken(this.#config.apiKey, this.#config.apiSecret, {
      identity: input.identity,
      name: input.name,
      metadata: input.metadata,
      ttl: input.ttlSeconds ?? LIVEKIT_TOKEN_TTL_SECONDS,
    });
    token.addGrant({
      room: input.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      // O SDK converte para as strings 'microphone'/'screen_share'/'screen_share_audio'
      // ao montar o JWT (decisão D6). Sem câmera no MVP.
      canPublishSources: [
        TrackSource.MICROPHONE,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO,
      ],
    });
    return token.toJwt();
  }

  verifyWebhook(rawBody: string, authHeader: string | undefined): Promise<WebhookEvent> {
    return this.#webhooks.receive(rawBody, authHeader);
  }
}

export function createLiveKitService(config: LiveKitConfig): LiveKitService {
  return new LiveKitSdkService(config);
}
