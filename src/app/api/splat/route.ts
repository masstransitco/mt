import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_DOMAINS = [
  'firebasestorage.googleapis.com',
];

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
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  if (!isAllowedDomain(url)) {
    return NextResponse.json(
      { error: 'Invalid domain' },
      { status: 403 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': '*/*',  // Accept any content type
        'Accept-Encoding': 'identity'  // Prevent compression
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    // Get the response as ArrayBuffer to preserve binary data exactly
    const buffer = await response.arrayBuffer();
    
    if (buffer.byteLength === 0) {
      throw new Error('Empty response received');
    }

    if (buffer.byteLength > 100 * 1024 * 1024) {
      throw new Error('File too large');
    }

    // Return binary data with headers optimized for binary transfer
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Transfer-Encoding': 'binary',  // Explicitly specify binary transfer
        'Content-Disposition': 'attachment; filename="scene.splat"',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Origin, Accept-Encoding',
        'Accept-Ranges': 'bytes',  // Support partial content requests
      },
    });
  } catch (error: any) {
    console.error('Error proxying file:', error);
    
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, Accept-Encoding',
      'Access-Control-Max-Age': '86400',
    },
  });
}
