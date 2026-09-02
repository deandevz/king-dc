/**
 * Kebab-case do nome do canal (decisão D17). Acentos viram a letra base, o resto que não
 * for `[a-z0-9]` vira hífen. Pode devolver string vazia (nome só com símbolos): quem chama
 * decide o que fazer.
 */
export function toSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
