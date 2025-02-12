import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Whitelist of allowed domains for security
const ALLOWED_DOMAINS = [
  'firebasestorage.googleapis.com',
  // Add other trusted domains as needed
];

// Helper to validate URL domain
function isAllowedDomain(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ALLOWED_DOMAINS.some(domain => url.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  // Input validation
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  // Domain validation
  if (!isAllowedDomain(url)) {
    return NextResponse.json(
      { error: 'Invalid domain' },
      { status: 403 }
    );
  }

  try {
    const controller = new AbortController();
    // 30 second timeout
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/octet-stream,*/*',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    // Validate content type if available
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('octet-stream') && !contentType.includes('model/splat')) {
      console.warn(`Unexpected content type: ${contentType}`);
    }

    const buffer = await response.arrayBuffer();
    
    // Validate buffer size
    if (buffer.byteLength === 0) {
      throw new Error('Empty response received');
    }

    if (buffer.byteLength > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('File too large');
    }

    // Return binary data with explicit headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',  // More generic content type
        'Content-Length': buffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': 'attachment; filename="scene.splat"',
        'X-Content-Type-Options': 'nosniff',  // Prevent MIME type sniffing
        'Vary': 'Origin'  // For proper CORS caching
      },
    });
  } catch (error: any) {
    console.error('Error proxying file:', error);
    
    // More specific error responses
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }
    
    if (error.message === 'File too large') {
      return NextResponse.json(
        { error: 'File exceeds size limit' },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to proxy file', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
