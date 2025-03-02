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

// Interfaces
interface PaymentMethod {
  id: string;         // Stripe PaymentMethod ID
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

  // Extract the token from the header
  const token = authHeader.split('Bearer ')[1];
  // Verify with Firebase Admin
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

      case 'delete-payment-method':
        return await handleDeletePaymentMethod(userId, data.paymentMethodId);

      case 'set-default-payment-method':
        // data.paymentMethodId is the Firestore doc ID or Stripe ID
        return await handleSetDefaultPaymentMethod(userId, data.paymentMethodId);

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
    // Verify the user’s Firebase token
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

    // Handle GET actions
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

// ----------- ACTION HANDLERS -----------

/**
 * Save a payment method to Firestore for the user.
 * Also updates main user doc with defaultPaymentMethodId if it's the first method or isDefault is true.
 */
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
    // If no existing methods, we treat this as the default
    const isFirst = snapshot.empty;

    // Create the doc in subcollection
    const newPaymentMethodRef = paymentMethodsRef.doc(); // doc ID for Firestore
    await newPaymentMethodRef.set({
      ...paymentMethod,
      isDefault: isFirst || paymentMethod.isDefault, 
      createdAt: new Date().toISOString(),
    });

    // If it's the first or the user specifically set isDefault: true
    if (isFirst || paymentMethod.isDefault) {
      // We store the Stripe PM ID in main user doc as defaultPaymentMethodId
      const userDocRef = db.collection('users').doc(userId);
      await userDocRef.update({ defaultPaymentMethodId: paymentMethod.id });
    }

    return successResponse({
      paymentMethod: { ...paymentMethod, isDefault: isFirst || paymentMethod.isDefault },
    });
  } catch (error) {
    console.error('Error saving payment method:', error);
    return errorResponse('Failed to save payment method', 500);
  }
}

/**
 * Set a payment method as default for the user.
 * 1) Unset `isDefault` on all other docs
 * 2) Set `isDefault = true` on the chosen doc
 * 3) Update main user doc with `defaultPaymentMethodId = paymentMethod.id` (the Stripe ID)
 */
async function handleSetDefaultPaymentMethod(userId: string, docId: string) {
  if (!docId) {
    return errorResponse('Payment method doc ID is required to set default');
  }

  try {
    // 1) fetch all PM docs
    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const allSnap = await paymentMethodsRef.get();

    // 2) We'll do a batch
    const batch = db.batch();

    // We'll store the PaymentMethod's Stripe ID to update user doc
    let newDefaultStripeId: string | null = null;

    // For each doc, if it matches docId => set isDefault: true, else false
    allSnap.forEach((doc) => {
      const data = doc.data() as PaymentMethod;
      if (doc.id === docId) {
        // set isDefault = true
        batch.update(doc.ref, { isDefault: true });
        newDefaultStripeId = data.id; // The actual Stripe PaymentMethod ID
      } else {
        // set isDefault = false
        if (data.isDefault) {
          batch.update(doc.ref, { isDefault: false });
        }
      }
    });

    if (!newDefaultStripeId) {
      // docId not found or doc had no 'id' field
      return errorResponse('Unable to find payment method doc or missing Stripe ID');
    }

    // 3) Update main user doc
    const userDocRef = db.collection('users').doc(userId);
    batch.update(userDocRef, { defaultPaymentMethodId: newDefaultStripeId });

    await batch.commit();

    return successResponse({ message: 'Default payment method updated.' });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    return errorResponse('Failed to set default payment method', 500);
  }
}

/**
 * Get all payment methods from Firestore for the user.
 */
async function handleGetPaymentMethods(userId: string) {
  try {
    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const snapshot = await paymentMethodsRef.orderBy('createdAt', 'desc').get();
    const paymentMethods = snapshot.docs.map((doc) => ({
      docId: doc.id,
      ...doc.data(),
    }));

    return successResponse({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return errorResponse('Failed to get payment methods', 500);
  }
}

/**
 * Create a Payment Intent with Stripe.
 */
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
      metadata: { userId },
    });

    return successResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      // Return a 402 for Stripe card/validation errors
      return errorResponse(error.message, 402);
    }
    console.error('Payment intent creation error:', error);
    return errorResponse('Failed to create payment intent', 500);
  }
}

/**
 * Delete a payment method doc from Firestore for the user.
 */
async function handleDeletePaymentMethod(userId: string, paymentMethodId: string) {
  if (!paymentMethodId) {
    return errorResponse('Payment method ID is required');
  }
  try {
    await db.collection(`users/${userId}/paymentMethods`).doc(paymentMethodId).delete();
    return successResponse({ message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return errorResponse('Failed to delete payment method', 500);
  }
}
