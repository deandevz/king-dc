import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ParticipantInfo, TrackInfo, TrackSource, TrackType } from 'livekit-server-sdk';
import sharp from 'sharp';
import { SESSION_COOKIE } from '@kingdc/contracts';
import { generateInviteCode, inviteExpiry } from '../src/lib/invites.js';
import { hashPassword } from '../src/lib/password.js';

export async function resetDb(app: FastifyInstance): Promise<void> {
  await app.prisma.session.deleteMany();
  await app.prisma.invite.deleteMany();
  await app.prisma.user.deleteMany();
  await app.prisma.channel.deleteMany();
  app.presence.clear();
}

export type SeededUser = { id: string; code: string; password: string };

export async function createUser(
  app: FastifyInstance,
  options: { code?: string; password?: string; isAdmin?: boolean; nickname?: string | null } = {},
): Promise<SeededUser> {
  const code = options.code ?? generateInviteCode();
  const password = options.password ?? 'senha-de-teste';
  const user = await app.prisma.user.create({
    data: {
      code,
      passwordHash: await hashPassword(password),
      isAdmin: options.isAdmin ?? false,
      nickname: options.nickname === undefined ? 'teste' : options.nickname,
    },
  });
  return { id: user.id, code, password };
}

export async function createInvite(
  app: FastifyInstance,
  createdById: string,
  overrides: { code?: string; expiresAt?: Date; usedAt?: Date } = {},
): Promise<string> {
  const code = overrides.code ?? generateInviteCode();
  await app.prisma.invite.create({
    data: {
      code,
      createdById,
      expiresAt: overrides.expiresAt ?? inviteExpiry(),
      usedAt: overrides.usedAt ?? null,
    },
  });
  return code;
}

export async function createChannel(
  app: FastifyInstance,
  slug: string,
  position: number,
): Promise<void> {
  await app.prisma.channel.create({ data: { slug, name: slug, position } });
}

/**
 * `light-my-request` é dependência transitiva do Fastify e não resolve por nome daqui, o
 * que faz `app.inject()` cair para `any`. Este é o pedaço da resposta que os testes usam.
 */
export type InjectedResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
  rawPayload: Buffer;
  cookies: Array<{ name: string; value: string; httpOnly?: boolean; sameSite?: string }>;
  json: () => unknown;
};

let ipCounter = 0;

/** Cada login sai de um IP novo: o rate limit é por IP e não pode contaminar outro teste. */
export function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`;
}

export function login(
  app: FastifyInstance,
  code: string,
  password: string,
  ip: string = freshIp(),
): Promise<InjectedResponse> {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'x-forwarded-for': ip },
    payload: { code, password },
  });
}

export function cookieFrom(response: InjectedResponse): string {
  const cookie = response.cookies.find((entry) => entry.name === SESSION_COOKIE);
  if (cookie === undefined) throw new Error('resposta sem cookie de sessão');
  return cookie.value;
}

export async function sessionFor(app: FastifyInstance, user: SeededUser): Promise<string> {
  const response = await login(app, user.code, user.password);
  if (response.statusCode !== 200) {
    throw new Error(`login de apoio falhou com ${response.statusCode}`);
  }
  return cookieFrom(response);
}

export function withSession(sid: string): { cookies: Record<string, string> } {
  return { cookies: { [SESSION_COOKIE]: sid } };
}

/** Monta um corpo `multipart/form-data` com um arquivo só. */
export function multipart(
  content: Buffer,
  options: { field?: string; filename?: string; contentType?: string } = {},
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----kingdc${randomBytes(8).toString('hex')}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${options.field ?? 'file'}"; ` +
      `filename="${options.filename ?? 'foto.png'}"\r\n` +
      `Content-Type: ${options.contentType ?? 'image/png'}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, content, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

export function pngFixture(width = 400, height = 300): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 90 } },
  })
    .png()
    .toBuffer();
}

export type FakeParticipant = {
  identity: string;
  name?: string;
  metadata?: string;
  mic?: 'live' | 'muted' | 'none';
  screen?: boolean;
};

/** `ParticipantInfo` de verdade do protocolo, para o mapeamento de presença ser real. */
export function participantInfo(options: FakeParticipant): ParticipantInfo {
  const tracks: TrackInfo[] = [];
  if (options.mic !== 'none') {
    tracks.push(
      new TrackInfo({
        sid: 'TR_mic',
        type: TrackType.AUDIO,
        source: TrackSource.MICROPHONE,
        muted: options.mic === 'muted',
      }),
    );
  }
  if (options.screen === true) {
    tracks.push(
      new TrackInfo({
        sid: 'TR_screen',
        type: TrackType.VIDEO,
        source: TrackSource.SCREEN_SHARE,
        muted: false,
      }),
    );
  }
  return new ParticipantInfo({
    identity: options.identity,
    name: options.name ?? '',
    metadata: options.metadata ?? '',
    tracks,
  });
}
