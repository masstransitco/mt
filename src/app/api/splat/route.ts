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
    // Fetch with explicit streaming
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    // Get the raw binary data
    const buffer = await response.arrayBuffer();

    // Return raw binary data with minimal headers
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error: any) {
    console.error('Error proxying file:', error);
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
      'Access-Control-Allow-Headers': '*'
    },
  });
}
