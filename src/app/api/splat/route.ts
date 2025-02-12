import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    
    // Return binary data with explicit headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'model/splat',
        'Content-Length': buffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
        'Content-Disposition': 'attachment; filename="scene.splat"'
      },
    });
  } catch (error) {
    console.error('Error proxying file:', error);
    return NextResponse.json(
      { error: 'Failed to proxy file' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}
