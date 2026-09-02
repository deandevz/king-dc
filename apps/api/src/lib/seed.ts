import { inviteCodeSchema } from '@kingdc/contracts';
import { readEnv } from '../env.js';
import { hashPassword } from './password.js';
import { createPrismaClient } from './prisma.js';

/** Canais iniciais do servidor (decisão D17). */
const CHANNELS = [
  { slug: 'geral', name: 'Geral' },
  { slug: 'jogos', name: 'Jogos' },
  { slug: 'musica', name: 'Música' },
  { slug: 'afk', name: 'AFK' },
];

/**
 * Idempotente: roda quantas vezes quiser. O admin converge para o `SEED_ADMIN_CODE` /
 * `SEED_ADMIN_PASSWORD` do ambiente, então rodar de novo também serve para resetar a senha.
 */
export async function runSeed(): Promise<void> {
  const env = readEnv();
  const code = process.env.SEED_ADMIN_CODE?.trim().toUpperCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (code === undefined || code.length === 0 || password === undefined || password.length === 0) {
    throw new Error('Defina SEED_ADMIN_CODE e SEED_ADMIN_PASSWORD antes de rodar o seed.');
  }

  // `POST /auth/login` só aceita códigos do alfabeto de D2 (sem 0/O/1/I). Um
  // SEED_ADMIN_CODE fora dele cria um admin que nunca consegue entrar.
  if (!inviteCodeSchema.safeParse(code).success) {
    console.warn(
      `seed: AVISO — o código "${code}" tem caracteres fora do alfabeto de convite ` +
        '(ABCDEFGHJKLMNPQRSTUVWXYZ23456789). Este admin não vai conseguir fazer login. ' +
        'Troque SEED_ADMIN_CODE no .env e rode o seed de novo.',
    );
  }

  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.user.upsert({
      where: { code },
      update: { isAdmin: true, passwordHash },
      create: { code, passwordHash, isAdmin: true },
    });
    console.warn(`seed: admin pronto (${admin.code})`);

    for (const [position, channel] of CHANNELS.entries()) {
      await prisma.channel.upsert({
        where: { slug: channel.slug },
        update: { name: channel.name, position },
        create: { slug: channel.slug, name: channel.name, position },
      });
    }
    console.warn(`seed: canais prontos (${CHANNELS.map((c) => c.slug).join(', ')})`);
  } finally {
    await prisma.$disconnect();
  }
}
