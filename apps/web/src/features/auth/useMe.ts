'use client';

import useSWR from 'swr';
import type { KeyedMutator } from 'swr';
import type { Me } from '@kingdc/contracts';
import { getMe } from '@/lib/api';
import type { ApiError } from '@/lib/api';

export const ME_KEY = '/me';

export type UseMe = {
  me: Me | undefined;
  error: ApiError | undefined;
  loading: boolean;
  mutate: KeyedMutator<Me>;
};

/** Usuário logado. É a fonte de `nickname`, `avatarUrl`, `code` e `isAdmin` em todo o app. */
export function useMe(): UseMe {
  const { data, error, isLoading, mutate } = useSWR<Me, ApiError>(ME_KEY, getMe, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  return { me: data, error, loading: isLoading, mutate };
}
