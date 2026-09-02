/** O mínimo de um `KeyboardEvent` para decidir o push-to-talk. */
export type PttKeyEvent = {
  code: string;
  repeat: boolean;
  target: EventTarget | null;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Digitando em um campo, a tecla do PTT é texto e não deve abrir o microfone. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

/** `keydown` que abre o microfone: tecla certa, sem repeat, sem modificador, fora de campo. */
export function shouldStartTalking(event: PttKeyEvent, pttKey: string): boolean {
  if (event.code !== pttKey) return false;
  if (event.repeat) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return !isTypingTarget(event.target);
}

/** `keyup` que fecha o microfone. Solta mesmo se o foco tiver ido para um campo. */
export function shouldStopTalking(event: Pick<PttKeyEvent, 'code'>, pttKey: string): boolean {
  return event.code === pttKey;
}
