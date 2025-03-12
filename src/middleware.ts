// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that should never be treated as car registrations
const PROTECTED_PATHS = [
  '/api/',
  '/_next/',
  '/static/',
  '/admin',
  '/login',
  '/signup',
  '/profile',
  '/settings',
  '/help',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/favicon.ico',
  '/robots.txt',
];

// Regex to match potential car registration format
const CAR_REGISTRATION_PATTERN = /^\/([a-zA-Z0-9]{3,8})$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  
  // First, check if it's a possible car registration URL
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path));
  const isCarRegistration = CAR_REGISTRATION_PATTERN.test(pathname) && !isProtectedPath;
  
  // If it looks like a car registration and we're on the main domain,
  // we'll let it through to be handled by [carRegistration]/page.tsx
  if (isCarRegistration) {
    return NextResponse.next();
  }
  
  // Check if the hostname is the admin subdomain
  if (hostname.startsWith('admin.')) {
    // If the request is already for the admin page, pass it through
    if (pathname.startsWith('/admin')) {
      return NextResponse.next();
    }
    
    // Otherwise, rewrite to the admin page
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }
  
  // Authentication checking (your existing logic)
  const session = request.cookies.get('__session')?.value;
  const publicPaths = ['/api/auth'];
  
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Only redirect if trying to access protected path without session
  if (!session && !isPublicPath && !pathname.startsWith('/_next')) {
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
