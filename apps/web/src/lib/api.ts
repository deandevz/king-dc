import {
  apiErrorSchema,
  channelsResponseSchema,
  channelTokenResponseSchema,
  createInviteResponseSchema,
  loginResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  PRESENCE_STALE_HEADER,
} from '@kingdc/contracts';
import type {
  ChannelsResponse,
  ChannelTokenResponse,
  CreateInviteResponse,
  ErrorCode,
  LoginRequest,
  Me,
} from '@kingdc/contracts';
import type { ZodType } from 'zod';

/** Erro de API já traduzido: sempre tem `code` de `packages/contracts` e mensagem pronta para a UI. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const NETWORK_MESSAGE = 'Sem conexão com o servidor. Tente de novo.';
const SHAPE_MESSAGE = 'O servidor respondeu num formato inesperado.';

const FALLBACK_MESSAGES: Record<number, string> = {
  401: 'Sessão expirada. Entre de novo.',
  403: 'Você não tem permissão para isso.',
  404: 'Não encontrado.',
  429: 'Muitas tentativas. Espere um minuto.',
  503: 'Serviço de voz indisponível no momento.',
};

function fallbackFor(status: number): { code: ErrorCode; message: string } {
  const message = FALLBACK_MESSAGES[status] ?? 'Deu ruim no servidor. Tente de novo.';
  if (status === 401) return { code: 'UNAUTHENTICATED', message };
  if (status === 403) return { code: 'FORBIDDEN', message };
  if (status === 404) return { code: 'NOT_FOUND', message };
  if (status === 429) return { code: 'RATE_LIMITED', message };
  return { code: 'INTERNAL', message };
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  json?: unknown;
  body?: BodyInit;
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Faz a requisição pelo rewrite `/api/*` (decisão D16) e normaliza qualquer falha. */
async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    });
  } catch {
    throw new ApiError(0, 'INTERNAL', NETWORK_MESSAGE);
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await readJson(response));
    const fallback = fallbackFor(response.status);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error.code : fallback.code,
      parsed.success ? parsed.data.error.message : fallback.message,
    );
  }

  return response;
}

async function requestParsed<T>(
  schema: ZodType<T>,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await request(path, options);
  const parsed = schema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiError(response.status, 'INTERNAL', SHAPE_MESSAGE);
  return parsed.data;
}

export async function login(body: LoginRequest): Promise<Me> {
  const data = await requestParsed(loginResponseSchema, '/auth/login', {
    method: 'POST',
    json: body,
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await requestParsed(logoutResponseSchema, '/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<Me> {
  return requestParsed(meResponseSchema, '/me');
}

export function updateNickname(nickname: string): Promise<Me> {
  return requestParsed(meResponseSchema, '/me', { method: 'PATCH', json: { nickname } });
}

export function uploadAvatar(file: File): Promise<Me> {
  const body = new FormData();
  body.append('file', file);
  return requestParsed(meResponseSchema, '/me/avatar', { method: 'PUT', body });
}

export function deleteAvatar(): Promise<Me> {
  return requestParsed(meResponseSchema, '/me/avatar', { method: 'DELETE' });
}

/** `stale` vem do header `X-Presence-Stale`: presença velha porque o LiveKit não respondeu. */
export type ChannelsResult = ChannelsResponse & { stale: boolean };

export async function getChannels(): Promise<ChannelsResult> {
  const response = await request('/channels');
  const parsed = channelsResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiError(response.status, 'INTERNAL', SHAPE_MESSAGE);
  return { ...parsed.data, stale: response.headers.get(PRESENCE_STALE_HEADER) === '1' };
}

export function createChannelToken(slug: string): Promise<ChannelTokenResponse> {
  return requestParsed(channelTokenResponseSchema, `/channels/${encodeURIComponent(slug)}/token`, {
    method: 'POST',
  });
}

export function createInvite(): Promise<CreateInviteResponse> {
  return requestParsed(createInviteResponseSchema, '/invites', { method: 'POST' });
}

/** Mensagem de erro pronta para toast, sem vazar objeto de erro cru na UI. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : NETWORK_MESSAGE;
}

/** Erro `VALIDATION` da API: é do campo, não da rede, então vai embaixo do input e não no toast. */
export function validationMessage(error: unknown): string | null {
  return error instanceof ApiError && error.code === 'VALIDATION' ? error.message : null;
}
