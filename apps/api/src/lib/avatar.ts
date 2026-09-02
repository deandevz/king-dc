import { randomBytes } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { AVATAR_SIZE } from '@kingdc/contracts';

/** Só o que a decisão D13 aceita na entrada. SVG fica de fora: não é imagem raster. */
const ALLOWED_INPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);

/** Teto de pixels decodificados: 5 MB de PNG comprimido podem virar gigabytes de bitmap. */
const MAX_INPUT_PIXELS = 40_000_000;

/** Arquivo que o `sharp` não decodifica, ou decodifica num formato que não aceitamos. */
export class AvatarInvalidError extends Error {}

/** Valida decodificando de verdade e devolve 256×256 WebP (decisão D13). */
export async function renderAvatar(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });

  let format: string | undefined;
  try {
    format = (await image.metadata()).format;
  } catch {
    throw new AvatarInvalidError('arquivo não é uma imagem que consigamos abrir');
  }

  if (format === undefined || !ALLOWED_INPUT_FORMATS.has(format)) {
    throw new AvatarInvalidError(`formato não aceito: ${format ?? 'desconhecido'}`);
  }

  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AvatarInvalidError('imagem corrompida ou incompleta');
  }
}

export function avatarPath(dir: string, userId: string): string {
  return join(dir, `${userId}.webp`);
}

/** Grava em arquivo temporário e renomeia: ninguém lê um avatar pela metade. */
export async function writeAvatar(dir: string, userId: string, data: Buffer): Promise<void> {
  const target = avatarPath(dir, userId);
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(temp, data);
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function removeAvatar(dir: string, userId: string): Promise<void> {
  await rm(avatarPath(dir, userId), { force: true });
}
