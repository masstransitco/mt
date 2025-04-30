import { NextResponse } from 'next/server';
import { adminAuth, setAdminRole } from '@/lib/firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';

export async function POST(request: Request) {
  try {
    // Get the authorization token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken: DecodedIdToken = await adminAuth.verifyIdToken(token);
    
    // Check if the requester is a super admin
    if (decodedToken.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Get request body
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json({ error: 'Missing required field: uid' }, { status: 400 });
    }
    
    // Set the admin role
    const result = await setAdminRole(uid);
    
    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Error assigning admin role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}