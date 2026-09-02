/** Rótulos legíveis para os `KeyboardEvent.code` mais comuns; o resto cai no próprio código. */
const NAMED: Record<string, string> = {
  Backquote: '`',
  Space: 'Espaço',
  Tab: 'Tab',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  CapsLock: 'Caps Lock',
  ControlLeft: 'Ctrl esq.',
  ControlRight: 'Ctrl dir.',
  ShiftLeft: 'Shift esq.',
  ShiftRight: 'Shift dir.',
  AltLeft: 'Alt esq.',
  AltRight: 'Alt dir.',
  MetaLeft: 'Cmd/Win esq.',
  MetaRight: 'Cmd/Win dir.',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Insert: 'Insert',
  Delete: 'Del',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadEnter: 'Num Enter',
  NumpadDecimal: 'Num .',
};

const PATTERNS: [RegExp, (match: string) => string][] = [
  [/^Key([A-Z])$/, (letter) => letter],
  [/^Digit(\d)$/, (digit) => digit],
  [/^Numpad(\d)$/, (digit) => `Num ${digit}`],
  [/^(F\d{1,2})$/, (key) => key],
];

/** `Backquote` → `` ` ``, `KeyV` → `V`, `ControlLeft` → `Ctrl esq.`; código desconhecido volta cru. */
export function pttKeyLabel(code: string): string {
  const named = NAMED[code];
  if (named !== undefined) return named;
  for (const [pattern, format] of PATTERNS) {
    const match = pattern.exec(code);
    if (match?.[1] !== undefined) return format(match[1]);
  }
  return code;
}
