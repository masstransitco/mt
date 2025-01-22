// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the Firebase auth session from cookie
  const session = request.cookies.get('__session')?.value;

  // List of paths that don't require authentication
  const publicPaths = ['/api/auth'];
  
  // Check if the path is public
  const isPublicPath = publicPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  // Only redirect if trying to access protected path without session
  if (!session && !isPublicPath && !request.nextUrl.pathname.startsWith('/_next')) {
    // Instead of redirecting, we'll let the client-side handle auth
    // The app will show the sign-in modal when needed
    return NextResponse.next();
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
