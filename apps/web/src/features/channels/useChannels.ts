'use client';

import useSWR from 'swr';
import { PRESENCE_POLL_MS } from '@kingdc/contracts';
import { getChannels } from '@/lib/api';
import type { ApiError, ChannelsResult } from '@/lib/api';

export const CHANNELS_KEY = '/channels';

export type UseChannels = {
  data: ChannelsResult | undefined;
  error: ApiError | undefined;
  loading: boolean;
};

/**
 * Canais com presença, por polling de 2 s (decisão D5). Sem WebSocket no MVP.
 *
 * Com erro no cache o SWR pausa o `refreshInterval` e só volta pelo retry de erro, que por
 * padrão dobra o intervalo a cada falha (2 s, 4 s, 8 s…): uma queda da API de 1 minuto
 * levaria minutos para ser notada de volta. O retry fixo mantém o ritmo do polling.
 */
export function useChannels(): UseChannels {
  const { data, error, isLoading } = useSWR<ChannelsResult, ApiError>(CHANNELS_KEY, getChannels, {
    refreshInterval: PRESENCE_POLL_MS,
    revalidateOnFocus: true,
    shouldRetryOnError: true,
    onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
      setTimeout(() => void revalidate({ retryCount }), PRESENCE_POLL_MS);
    },
    keepPreviousData: true,
  });

  return { data, error, loading: isLoading };
}
