import { NextResponse } from 'next/server';

export function middleware(request) {
  const response = NextResponse.next();

  // Aplicar headers de cache solo a archivos estáticos y JavaScript
  if (
    request.nextUrl.pathname.startsWith('/_next/static/') ||
    request.nextUrl.pathname.endsWith('.js') ||
    request.nextUrl.pathname.endsWith('.css')
  ) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400'
    );
  }

  // Para las páginas, usar un cache más corto
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=3600, must-revalidate'
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/image|favicon.ico).*)',
  ],
};
