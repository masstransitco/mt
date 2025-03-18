// src/app/api/qr/route.ts

import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { generateCarQrUrl } from '@/lib/stationUtils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const registration = searchParams.get('registration');
  
  if (!registration) {
    return NextResponse.json(
      { error: 'Missing registration parameter' },
      { status: 400 }
    );
  }
  
  try {
    const url = generateCarQrUrl(registration);
    
    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return NextResponse.json({ 
      qrDataUrl,
      url 
    });
  } catch (error) {
    console.error('QR generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
