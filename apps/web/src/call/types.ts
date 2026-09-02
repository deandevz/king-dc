// A interface do módulo `call/` está documentada em docs/ARQUITETURA.md e vive em
// packages/contracts. Aqui só reexportamos para que o resto do app importe de `@/call`.
export type {
  AudioPrefs,
  CallConnectionState,
  CallRoomProps,
  MicTest,
} from '@kingdc/contracts';
export { DEFAULT_AUDIO_PREFS } from '@kingdc/contracts';
