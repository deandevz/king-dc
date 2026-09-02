import { Suspense } from 'react';
import type { JSX, ReactNode } from 'react';
import { AppBooting, AppShell } from '@/features/shell/AppShell';

/** O shell lê `?settings=1`, então precisa de um limite de Suspense acima dele. */
export default function AppLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Suspense fallback={<AppBooting />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
