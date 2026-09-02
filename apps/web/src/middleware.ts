import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@kingdc/contracts';

/**
 * `/dev-call` é a página de teste da sala: ela não tem sessão nem `getToken` da API,
 * recebe url e token pela query. Só existe quando a build foi feita com a flag ligada
 * (a própria página devolve 404 sem ela), então a portaria a libera na mesma condição.
 */
const DEV_CALL_OPEN = process.env.NEXT_PUBLIC_DEV_CALL === '1';

/**
 * Portaria de rotas: sem cookie de sessão só existe `/login`; com cookie,
 * `/login` devolve para `/app`. A validade do cookie é conferida pela API, não aqui.
 */
export function middleware(request: NextRequest): NextResponse {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  const isLogin = pathname === '/login';
  const isOpen = isLogin || (DEV_CALL_OPEN && pathname === '/dev-call');

  if (!signedIn && !isOpen) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (signedIn && isLogin) {
    return NextResponse.redirect(new URL('/app', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|avatars|sounds|favicon.ico|robots.txt).*)'],
};
