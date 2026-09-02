'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Toast } from '@/ui';

type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 6000;

/** Toast único no canto inferior direito (decisão D20): o novo substitui o anterior. */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (timer.current !== null) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {message !== null ? <Toast message={message} onDismiss={() => setMessage(null)} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error('useToast precisa de um ToastProvider acima.');
  return api;
}
