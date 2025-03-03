// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  
  // Check if the hostname is the admin subdomain
  if (hostname.startsWith('admin.')) {
    // If the request is already for the admin page, pass it through
    if (request.nextUrl.pathname.startsWith('/admin')) {
      return NextResponse.next();
    }
    
    // Otherwise, rewrite to the admin page
    const url = request.nextUrl.clone();
    url.pathname = `/admin${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }
  
  // Authentication checking (your existing logic)
  const session = request.cookies.get('__session')?.value;
  const publicPaths = ['/api/auth'];
  
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
