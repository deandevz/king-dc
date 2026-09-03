import { userVolumesSchema } from '@kingdc/contracts';
import type { UserVolumes } from '@kingdc/contracts';

/** Lê o mapa do localStorage; qualquer coisa inválida vira mapa vazio (todo mundo em 1). */
export function parseUserVolumes(raw: string | null): UserVolumes {
  if (raw === null) return {};
  try {
    const parsed = userVolumesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Volume de um participante; ausente é o padrão 1. */
export function userVolume(volumes: UserVolumes, userId: string): number {
  return volumes[userId] ?? 1;
}

/** Grava o volume preso em 0..1. Voltar para 1 apaga a entrada, para o mapa não crescer. */
export function withUserVolume(volumes: UserVolumes, userId: string, value: number): UserVolumes {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  const { [userId]: _removed, ...rest } = volumes;
  return clamped === 1 ? rest : { ...rest, [userId]: clamped };
}

export function volumeLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}
