// src/app/api/stripe/route.ts

/**
 * Force this route to run on the Node.js runtime (rather than the Edge runtime),
 * which supports the firebase-admin SDK.
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin and get Firestore/Auth
const { db, auth } = initializeFirebaseAdmin();

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

interface CreatePaymentIntentData {
  amount: number;
  currency?: string;
  paymentMethodId: string;
  userId: string;
}

// Auth middleware to verify the user’s Firebase ID token
async function verifyAuth(req: NextRequest) {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization token');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await auth.verifyIdToken(token);
  return decodedToken.uid;
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Helper for error responses
const errorResponse = (message: string, status: number = 400) => {
  return NextResponse.json({ success: false, error: message }, { status });
};

// Helper for success responses
const successResponse = (data: any) => {
  return NextResponse.json({ success: true, ...data });
};

// POST /api/stripe
export async function POST(request: NextRequest) {
  try {
    // Verify the user’s Firebase token
    const authenticatedUserId = await verifyAuth(request);

    // Expect a JSON body with { action, userId, ...data }
    const { action, userId, ...data } = await request.json();

    // Check for ownership
    if (authenticatedUserId !== userId) {
      return errorResponse('Unauthorized access', 403);
    }

    // Handle various actions
    switch (action) {
      case 'save-payment-method':
        return await handleSavePaymentMethod({ userId, paymentMethod: data.paymentMethod });
      case 'create-payment-intent':
        return await handleCreatePaymentIntent({ ...data, userId });
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('POST /api/stripe Error:', error);
    if (error instanceof Error && error.message.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// GET /api/stripe
export async function GET(request: NextRequest) {
  try {
    const authenticatedUserId = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    if (!userId) {
      return errorResponse('User ID is required');
    }
    if (authenticatedUserId !== userId) {
      return errorResponse('Unauthorized access', 403);
    }

    switch (action) {
      case 'get-payment-methods':
        return await handleGetPaymentMethods(userId);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('GET /api/stripe Error:', error);
    if (error instanceof Error && error.message.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// Helper function: Save Payment Method
async function handleSavePaymentMethod({
  userId,
  paymentMethod,
}: {
  userId: string;
  paymentMethod: PaymentMethod;
}) {
  if (!userId || !paymentMethod) {
    return errorResponse('Missing required fields');
  }

  try {
    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const snapshot = await paymentMethodsRef.get();
    const isDefault = snapshot.empty; // Mark the first as default

    const newPaymentMethodRef = paymentMethodsRef.doc();
    await newPaymentMethodRef.set({
      ...paymentMethod,
      isDefault,
      createdAt: new Date().toISOString(),
    });

    return successResponse({ paymentMethod: { ...paymentMethod, isDefault } });
  } catch (error) {
    console.error('Error saving payment method:', error);
    return errorResponse('Failed to save payment method', 500);
  }
}

// Helper function: Get Payment Methods
async function handleGetPaymentMethods(userId: string) {
  try {
    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const snapshot = await paymentMethodsRef.orderBy('createdAt', 'desc').get();
    const paymentMethods = snapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data(),
    }));

    return successResponse({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return errorResponse('Failed to get payment methods', 500);
  }
}

// Helper function: Create Payment Intent
async function handleCreatePaymentIntent({
  amount,
  currency = 'hkd',
  paymentMethodId,
  userId,
}: CreatePaymentIntentData) {
  if (!amount || !paymentMethodId || !userId) {
    return errorResponse('Amount, payment method, and user ID are required');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return errorResponse('App URL is not configured');
  }

  try {
    // Search for an existing Stripe Customer for this user
    const customerSearchResult = await stripe.customers.search({
      query: `metadata['userId']:'${userId}'`,
    });

    let customerId: string;
    if (customerSearchResult.data.length > 0) {
      customerId = customerSearchResult.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        metadata: { userId },
      });
      customerId = customer.id;
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${appUrl}/booking/confirmation`,
      metadata: {
        userId,
      },
    });

    return successResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return errorResponse(error.message, 402);
    }
    console.error('Payment intent creation error:', error);
    return errorResponse('Failed to create payment intent', 500);
  }
}
