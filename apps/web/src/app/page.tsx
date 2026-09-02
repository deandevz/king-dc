import { redirect } from 'next/navigation';

/** A raiz não tem tela própria: com sessão vai para o app, sem sessão o middleware manda para /login. */
export default function RootPage(): never {
  redirect('/app');
}
