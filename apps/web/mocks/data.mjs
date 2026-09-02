/**
 * Estado em memória do mock de desenvolvimento. Descartável: existe só para rodar o front
 * (e os e2e) sem a API real. Os dados imitam os mockups de `design/minimal/`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** PNG 1×1 transparente, devolvido em `/avatars/*` para o preview não quebrar. */
export const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function participant(userId, nickname, extra = {}) {
  return { userId, nickname, avatarUrl: null, micMuted: false, screenSharing: false, ...extra };
}

/** Presença fixa: "Geral" com 4 pessoas, uma mutada e uma compartilhando tela. */
function seedChannels() {
  return [
    {
      id: 'ch-geral',
      slug: 'geral',
      name: 'Geral',
      position: 0,
      participants: [
        participant('u-lele', 'lele'),
        participant('u-tonhao', 'tonhão', { micMuted: true }),
        participant('u-duda', 'duda'),
        participant('u-vitao', 'vitão', { screenSharing: true }),
      ],
    },
    {
      id: 'ch-jogos',
      slug: 'jogos',
      name: 'Jogos',
      position: 1,
      participants: [participant('u-rafa', 'rafa'), participant('u-mari', 'mari', { micMuted: true })],
    },
    { id: 'ch-musica', slug: 'musica', name: 'Música', position: 2, participants: [] },
    { id: 'ch-afk', slug: 'afk', name: 'AFK', position: 3, participants: [] },
  ];
}

function seedUsers() {
  return new Map([
    [
      // Mesmo código do seed real (SEED_ADMIN_CODE): o alfabeto de D2 não tem I nem 1.
      'ADMKNG',
      {
        id: 'u-admin',
        code: 'ADMKNG',
        password: 'admin123',
        nickname: null,
        avatarVersion: null,
        isAdmin: true,
      },
    ],
    [
      'BRUCE7',
      {
        id: 'u-bruce',
        code: 'BRUCE7',
        password: 'bruce123',
        nickname: 'bruce',
        avatarVersion: null,
        isAdmin: false,
      },
    ],
  ]);
}

function seedInvites(now) {
  return new Map([
    ['KNG742', { code: 'KNG742', createdAt: now - DAY_MS, expiresAt: now + 6 * DAY_MS, usedAt: null }],
    ['EXPRD2', { code: 'EXPRD2', createdAt: now - 9 * DAY_MS, expiresAt: now - 2 * DAY_MS, usedAt: null }],
  ]);
}

export function createState() {
  const now = Date.now();
  return {
    users: seedUsers(),
    invites: seedInvites(now),
    channels: seedChannels(),
    sessions: new Map(),
    loginAttempts: [],
    nextId: 1,
  };
}

export function meOf(user) {
  return {
    id: user.id,
    code: user.code,
    nickname: user.nickname,
    avatarUrl: user.avatarVersion === null ? null : `/avatars/${user.id}.webp?v=${user.avatarVersion}`,
    isAdmin: user.isAdmin,
  };
}

export function channelsPayload(state) {
  const online = new Set();
  for (const channel of state.channels) {
    for (const person of channel.participants) online.add(person.userId);
  }
  return { channels: state.channels, onlineCount: online.size };
}

/** Alfabeto da decisão D2: maiúsculas e dígitos sem 0/O/1/I. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode() {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function issueInvite(state, userId) {
  const now = Date.now();
  const invite = {
    code: randomCode(),
    createdById: userId,
    createdAt: now,
    expiresAt: now + 7 * DAY_MS,
    usedAt: null,
  };
  state.invites.set(invite.code, invite);
  return invite;
}

/** Rate limit da API: 10 tentativas de login por minuto. */
export function rateLimited(state) {
  const now = Date.now();
  state.loginAttempts = state.loginAttempts.filter((at) => now - at < 60_000);
  state.loginAttempts.push(now);
  return state.loginAttempts.length > 10;
}
