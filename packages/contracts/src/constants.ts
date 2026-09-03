/** Alfabeto do código de convite: maiúsculas e dígitos sem 0/O/1/I (decisão D2). */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Todo código de convite/login tem exatamente 6 caracteres. */
export const CODE_LENGTH = 6;

/** Validade de um convite recém-criado, em dias. */
export const INVITE_TTL_DAYS = 7;

/** Limites do apelido (decisão D14). */
export const NICK_MIN = 2;
export const NICK_MAX = 24;

/** Limites da senha. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Limites do nome de canal. */
export const CHANNEL_NAME_MIN = 1;
export const CHANNEL_NAME_MAX = 32;

/** Tamanho máximo aceito no upload de avatar, antes do processamento (decisão D13). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Lado do avatar final, em pixels. */
export const AVATAR_SIZE = 256;

/** Quantidade de gradientes da paleta de avatar sem foto (decisão D13). */
export const AVATAR_GRADIENT_COUNT = 7;

/** TTL do token do LiveKit, em segundos (decisão D6). */
export const LIVEKIT_TOKEN_TTL_SECONDS = 6 * 60 * 60;

/** Intervalo de renovação do token pelo front, em milissegundos (decisão D6). */
export const LIVEKIT_TOKEN_REFRESH_MS = 5 * 60 * 60 * 1000;

/** Intervalo do polling de presença na tela principal (decisão D5). */
export const PRESENCE_POLL_MS = 2000;

/** Vida do cache de presença na API (decisão D5). */
export const PRESENCE_CACHE_MS = 2000;

/** Nome do cookie de sessão (decisão D15). */
export const SESSION_COOKIE = 'kingdc.sid';

/** Vida da sessão, em dias (decisão D15). */
export const SESSION_TTL_DAYS = 30;

/** Chave do localStorage com as preferências de áudio (decisão D10). */
export const AUDIO_PREFS_STORAGE_KEY = 'kingdc.audio';

/** Chave do localStorage com o volume por participante (decisão D26). */
export const USER_VOLUMES_STORAGE_KEY = 'kingdc.volumes';

/** Tecla padrão do push-to-talk (decisão D12). */
export const DEFAULT_PTT_KEY = 'Backquote';

/** Header que sinaliza presença servida de cache velho porque o LiveKit não respondeu. */
export const PRESENCE_STALE_HEADER = 'x-presence-stale';
