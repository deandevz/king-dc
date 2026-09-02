/**
 * Perfil de quem está na sala. Nick e foto viajam no `metadata` do token (decisão D6),
 * então não existe round-trip à API para montar a lista de participantes.
 */
export type ParticipantProfile = {
  nickname: string;
  avatarUrl: string | null;
};

function firstNonEmpty(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim() ?? '';
    if (trimmed !== '') return trimmed;
  }
  return '';
}

/**
 * Lê `{nickname, avatarUrl}` do metadata do participante. Metadata ausente, inválido ou
 * com campos de outro tipo cai no `name` do participante e, por último, na identidade.
 */
export function parseParticipantProfile(
  metadata: string | undefined,
  name: string | undefined,
  identity: string,
): ParticipantProfile {
  const fallbackNickname = firstNonEmpty(name, identity);
  const raw = metadata?.trim() ?? '';
  if (raw === '') return { nickname: fallbackNickname, avatarUrl: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { nickname: fallbackNickname, avatarUrl: null };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { nickname: fallbackNickname, avatarUrl: null };
  }

  const record = parsed as Record<string, unknown>;
  const nicknameField = typeof record.nickname === 'string' ? record.nickname : undefined;
  const avatarField = typeof record.avatarUrl === 'string' ? record.avatarUrl.trim() : '';

  return {
    nickname: firstNonEmpty(nicknameField, fallbackNickname),
    avatarUrl: avatarField === '' ? null : avatarField,
  };
}
