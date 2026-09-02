/** Junta nomes de classe ignorando `false`/`undefined`. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
