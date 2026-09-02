/**
 * Mock descartável da API (docs/ARQUITETURA.md), em memória, sem framework.
 * Sobe com `pnpm mock` na porta 3900 e é o alvo do rewrite quando
 * `API_INTERNAL_URL=http://localhost:3900`. Não vai para produção.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import {
  channelsPayload,
  createState,
  issueInvite,
  meOf,
  PIXEL_PNG,
  rateLimited,
} from './data.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 3900);
const COOKIE = 'kingdc.sid';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Com as chaves do LiveKit no ambiente o mock emite token de verdade, e o front conecta
 * numa sala real (é assim que os e2e conferem a sala em vez de um texto de stub). Sem elas
 * o token continua falso, que é o suficiente para as telas que não entram na call.
 */
const LIVEKIT = {
  url: process.env.LIVEKIT_URL ?? '',
  apiKey: process.env.LIVEKIT_API_KEY ?? '',
  apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
};
const LIVEKIT_READY = LIVEKIT.url !== '' && LIVEKIT.apiKey !== '' && LIVEKIT.apiSecret !== '';

let state = createState();
/** Simula a API fora do ar em `GET /channels` (500 sem corpo, como o rewrite do Next devolve). */
let channelsDown = false;

function send(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}

function fail(res, status, code, message) {
  send(res, status, { error: { code, message } });
}

function readCookie(req) {
  const raw = req.headers.cookie ?? '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

function sessionCookie(id, maxAge) {
  return `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function currentUser(req) {
  const sid = readCookie(req);
  if (sid === null) return null;
  const userId = state.sessions.get(sid);
  if (userId === undefined) return null;
  return [...state.users.values()].find((user) => user.id === userId) ?? null;
}

async function readBody(req, limit = AVATAR_MAX_BYTES + 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const body = await readBody(req, 1024 * 1024);
  if (body === null || body.length === 0) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    return {};
  }
}

function loginUser(res, user) {
  const sid = randomUUID();
  state.sessions.set(sid, user.id);
  send(res, 200, { user: meOf(user) }, { 'set-cookie': sessionCookie(sid, 30 * 24 * 60 * 60) });
}

async function handleLogin(req, res) {
  const body = await readJson(req);
  const code = String(body.code ?? '').toUpperCase();
  const password = String(body.password ?? '');

  if (rateLimited(state)) {
    return fail(res, 429, 'RATE_LIMITED', 'Muitas tentativas. Espere um minuto.');
  }

  const user = state.users.get(code);
  if (user !== undefined) {
    if (user.password !== password) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Código ou senha incorretos.');
    }
    return loginUser(res, user);
  }

  const invite = state.invites.get(code);
  if (invite === undefined) {
    return fail(res, 401, 'INVALID_CREDENTIALS', 'Código ou senha incorretos.');
  }
  if (invite.usedAt !== null || invite.expiresAt < Date.now()) {
    return fail(res, 401, 'INVITE_EXPIRED', 'Esse convite já foi usado ou expirou.');
  }
  if (password.length < 8) {
    return fail(res, 400, 'VALIDATION', 'A senha precisa de pelo menos 8 caracteres.');
  }

  invite.usedAt = Date.now();
  const created = {
    id: `u-new-${state.nextId++}`,
    code,
    password,
    nickname: null,
    avatarVersion: null,
    isAdmin: false,
  };
  state.users.set(code, created);
  return loginUser(res, created);
}

async function handleMe(req, res, user) {
  if (req.method === 'GET') return send(res, 200, meOf(user));

  if (req.method === 'PATCH') {
    const body = await readJson(req);
    const nickname = String(body.nickname ?? '').trim();
    // Mesma regra da decisão D14: tamanho e nada de controle/formatação (zero-width etc.).
    if (nickname.length < 2 || nickname.length > 24 || /[\p{Cc}\p{Cf}]/u.test(nickname)) {
      const message = 'O nick precisa ter de 2 a 24 caracteres visíveis, sem caracteres de controle.';
      return fail(res, 400, 'VALIDATION', message);
    }
    user.nickname = nickname;
    return send(res, 200, meOf(user));
  }

  return fail(res, 404, 'NOT_FOUND', 'Rota não encontrada.');
}

async function handleAvatar(req, res, user) {
  if (req.method === 'DELETE') {
    user.avatarVersion = null;
    return send(res, 200, meOf(user));
  }

  const body = await readBody(req);
  if (body === null) {
    return fail(res, 413, 'AVATAR_TOO_LARGE', 'A imagem passa de 5 MB.');
  }
  if (body.length === 0) {
    return fail(res, 400, 'AVATAR_INVALID', 'Arquivo de imagem inválido.');
  }
  user.avatarVersion = Date.now();
  return send(res, 200, meOf(user));
}

async function handleChannels(req, res, user) {
  if (req.method === 'GET') return send(res, 200, channelsPayload(state));
  if (!user.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Só o admin cria canal.');

  const body = await readJson(req);
  const name = String(body.name ?? '').trim();
  if (name.length === 0 || name.length > 32) {
    return fail(res, 400, 'VALIDATION', 'Nome de canal inválido.');
  }
  const channel = {
    id: `ch-${state.nextId++}`,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name,
    position: state.channels.length,
    participants: [],
  };
  state.channels.push(channel);
  return send(res, 200, { id: channel.id, slug: channel.slug, name, position: channel.position });
}

/** Mesmas garantias da decisão D6: identity = id do usuário, room = slug, TTL de 6 h. */
async function mintToken(user, slug) {
  const me = meOf(user);
  const token = new AccessToken(LIVEKIT.apiKey, LIVEKIT.apiSecret, {
    identity: me.id,
    name: me.nickname ?? me.code,
    metadata: JSON.stringify({ nickname: me.nickname, avatarUrl: me.avatarUrl }),
    ttl: '6h',
  });
  token.addGrant({
    roomJoin: true,
    room: slug,
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

async function handleToken(res, slug, user) {
  const channel = state.channels.find((item) => item.slug === slug);
  if (channel === undefined) return fail(res, 404, 'NOT_FOUND', 'Canal não encontrado.');
  return send(res, 200, {
    token: LIVEKIT_READY ? await mintToken(user, slug) : `mock-token-${slug}`,
    url: LIVEKIT_READY ? LIVEKIT.url : 'wss://mock.livekit.local',
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  });
}

function handleInvites(req, res, user) {
  if (!user.isAdmin) return fail(res, 403, 'FORBIDDEN', 'Só o admin gera convite.');
  if (req.method === 'GET') {
    const invites = [...state.invites.values()].map((invite) => ({
      code: invite.code,
      createdAt: new Date(invite.createdAt).toISOString(),
      expiresAt: new Date(invite.expiresAt).toISOString(),
      usedAt: invite.usedAt === null ? null : new Date(invite.usedAt).toISOString(),
    }));
    return send(res, 200, { invites });
  }
  const invite = issueInvite(state, user.id);
  return send(res, 200, {
    code: invite.code,
    expiresAt: new Date(invite.expiresAt).toISOString(),
  });
}

const PUBLIC_ROUTES = new Set(['/health', '/auth/login', '/__reset', '/__outage']);

async function route(req, res, path) {
  if (path === '/__reset') {
    state = createState();
    channelsDown = false;
    return send(res, 200, { ok: true });
  }
  if (path === '/__outage') {
    channelsDown = (await readJson(req)).channels === true;
    return send(res, 200, { ok: true });
  }
  if (path === '/channels' && channelsDown) {
    res.writeHead(500);
    return res.end();
  }
  if (path === '/health') return send(res, 200, { ok: true, db: true, livekit: true });
  if (path === '/auth/login' && req.method === 'POST') return handleLogin(req, res);
  if (path.startsWith('/avatars/')) {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return res.end(PIXEL_PNG);
  }

  const user = currentUser(req);
  if (user === null && !PUBLIC_ROUTES.has(path)) {
    return fail(res, 401, 'UNAUTHENTICATED', 'Faça login para continuar.');
  }

  if (path === '/auth/logout' && req.method === 'POST') {
    const sid = readCookie(req);
    if (sid !== null) state.sessions.delete(sid);
    return send(res, 200, { ok: true }, { 'set-cookie': sessionCookie('', 0) });
  }
  if (path === '/me') return handleMe(req, res, user);
  if (path === '/me/avatar') return handleAvatar(req, res, user);
  if (path === '/channels') return handleChannels(req, res, user);
  if (path === '/invites') return handleInvites(req, res, user);

  const token = /^\/channels\/([^/]+)\/token$/.exec(path);
  if (token !== null && req.method === 'POST') {
    return handleToken(res, decodeURIComponent(token[1]), user);
  }

  return fail(res, 404, 'NOT_FOUND', 'Rota não encontrada.');
}

const server = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  route(req, res, path).catch(() => fail(res, 500, 'INTERNAL', 'Erro no mock.'));
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`mock da API do King DC em http://127.0.0.1:${PORT}\n`);
});
