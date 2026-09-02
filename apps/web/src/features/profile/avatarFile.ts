import { AVATAR_MAX_BYTES } from '@kingdc/contracts';

/** Tipos aceitos no upload de avatar (decisão D13). A API revalida decodificando a imagem. */
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** Texto do limite mostrado na UI, alinhado com a API (5 MB, não os 2 MB do mockup). */
export const AVATAR_LIMIT_LABEL = 'PNG, JPG ou WebP, até 5 MB';

/** Validação client: devolve a mensagem de erro ou `null` quando o arquivo serve. */
export function validateAvatar(file: File): string | null {
  if (!ALLOWED.has(file.type)) return 'Formato não aceito. Use PNG, JPG ou WebP.';
  if (file.size > AVATAR_MAX_BYTES) return 'A imagem passa de 5 MB.';
  return null;
}
