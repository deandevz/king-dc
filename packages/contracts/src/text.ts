import { z } from 'zod';

/**
 * Caracteres que não aparecem na tela e só servem para confundir: controle (`Cc`, inclui
 * tab e quebra de linha), formatação (`Cf`: zero-width, RTL override), surrogate solto
 * (`Cs`, que o Postgres troca por `�`) e os "brancos" que o Unicode não classifica como
 * espaço: braille vazio (U+2800) e os fillers do hangul (U+115F, U+1160, U+3164, U+FFA0).
 */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\u2800\u115F\u1160\u3164\uFFA0]/u;

/** Ao menos um caractere que não é espaço nem separador. */
const VISIBLE = /[^\s\p{Z}]/u;

export const INVISIBLE_CHARS_MESSAGE = 'Não pode ter caracteres invisíveis ou de controle.';
export const NO_VISIBLE_CHAR_MESSAGE = 'Precisa ter ao menos um caractere visível.';

/**
 * Texto curto digitado pelo usuário (apelido, nome de canal): trim, tamanho em unidades
 * UTF-16 (`String.length`, igual ao `maxLength` do front) e nada invisível (D14, D17).
 */
export function visibleTextSchema(min: number, max: number): z.ZodString {
  return z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !INVISIBLE.test(value), INVISIBLE_CHARS_MESSAGE)
    .refine((value) => VISIBLE.test(value), NO_VISIBLE_CHAR_MESSAGE);
}
