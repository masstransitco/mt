// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Public paths that don't require authentication
  const publicPaths = ['/signin', '/api/auth'];
  
  // Check if the path is public
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // Get the Firebase auth session from cookie
  const session = request.cookies.get('__session')?.value;

  if (!session && !isPublicPath) {
    // Redirect to signin if no session and trying to access protected route
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  if (session && request.nextUrl.pathname === '/signin') {
    // Redirect to home if has session and trying to access signin
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/auth/* (auth endpoints)
     * 2. /_next/* (Next.js internals)
     * 3. /static/* (static files)
     * 4. /favicon.ico, /robots.txt (public files)
     */
    '/((?!api/auth|_next/static|_next/image|static|favicon.ico|robots.txt).*)',
  ],
};
