import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get session or token from cookie/header
  const isAuthenticated = request.cookies.get('auth_token'); // adjust based on your auth setup

  // List of public paths that don't require authentication
  const publicPaths = ['/signin'];

  // Check if the requested path is public
  const isPublicPath = publicPaths.includes(request.nextUrl.pathname);

  if (!isAuthenticated && !isPublicPath) {
    // Redirect to signin if trying to access protected route while not authenticated
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  if (isAuthenticated && isPublicPath) {
    // Redirect to home if trying to access signin while authenticated
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
