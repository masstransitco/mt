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
  id?: string;         // The Stripe PaymentMethod ID
  stripeId?: string;   // Alternative field name for the Stripe PaymentMethod ID
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

// Helper to create user document if it doesn't exist
async function ensureUserExists(userId: string) {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  
  if (!userSnap.exists) {
    // Create a new user document with default values
    await userRef.set({
      uid: userId,
      balance: 0,
      createdAt: new Date().toISOString(),
    });
    return { exists: false, data: { balance: 0, uid: userId } };
  }
  
  return { exists: true, data: userSnap.data() || {} };
}

// Auth middleware to verify the user's Firebase ID token
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
    // Verify the user's Firebase token
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
        // data.paymentMethodId is the Firestore doc ID
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
    // Verify the user's Firebase token
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

/** ------------------------------------------------------------------
 * ACTION HANDLERS
 * ------------------------------------------------------------------*/

/**
 * Save a payment method to Firestore for the user.
 * 1) Ensure the user has a Stripe Customer (create if needed).
 * 2) Attach the PaymentMethod to that Customer in Stripe.
 * 3) Create a doc in Firestore subcollection.
 * 4) If it's the first or isDefault, store defaultPaymentMethodId in user doc.
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
    // Get or create user doc
    const { exists, data } = await ensureUserExists(userId);
    const userData = data || {}; // Ensure userData is always an object
    
    let stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const newCustomer = await stripe.customers.create({
        metadata: { userId },
        // optional: email: userData.email,
      });
      stripeCustomerId = newCustomer.id;
      await db.collection("users").doc(userId).update({ 
        stripeCustomerId,
        updatedAt: new Date().toISOString()
      });
    }

    // Get the payment method ID - support both id and stripeId fields
    const paymentMethodId = paymentMethod.stripeId || paymentMethod.id;
    if (!paymentMethodId) {
      return errorResponse('Payment method ID is required', 400);
    }

    // Attach this PaymentMethod to the Stripe customer
    // This ensures it can be reused for off-session charges
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    } catch (err: any) {
      if (err.code === 'resource_already_exists') {
        console.log(`Payment method ${paymentMethodId} already attached to customer ${stripeCustomerId}`);
      } else {
        throw err;
      }
    }

    // If it's the user's first card or user set isDefault: true, set as default in Stripe
    // (optional, but recommended)
    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const snapshot = await paymentMethodsRef.get();
    const isFirst = snapshot.empty;
    const finalIsDefault = isFirst || paymentMethod.isDefault;

    if (finalIsDefault) {
      // Make it the default in the customer's invoice settings
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Now create the doc in Firestore
    const newPaymentMethodRef = paymentMethodsRef.doc(); // doc ID for Firestore
    await newPaymentMethodRef.set({
      ...paymentMethod,
      // Ensure we always store the id field in Firestore
      id: paymentMethodId,
      isDefault: finalIsDefault,
      createdAt: new Date().toISOString(),
    });

    // If it's the first or isDefault, also update the user doc
    // so we store defaultPaymentMethodId = Stripe PM ID
    if (finalIsDefault) {
      await db.collection("users").doc(userId).update({ 
        defaultPaymentMethodId: paymentMethodId,
        updatedAt: new Date().toISOString()
      });
    }

    return successResponse({
      paymentMethod: {
        ...paymentMethod,
        id: paymentMethodId,
        isDefault: finalIsDefault,
      },
    });
  } catch (error: any) {
    console.error('Error saving payment method:', error);
    return errorResponse(error.message || 'Failed to save payment method', 500);
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
    // Ensure user exists
    await ensureUserExists(userId);
    
    await db
      .collection(`users/${userId}/paymentMethods`)
      .doc(paymentMethodId)
      .delete();

    return successResponse({ message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return errorResponse('Failed to delete payment method', 500);
  }
}

/**
 * Set a payment method as default for the user.
 * 1) Unset `isDefault` on all other docs
 * 2) Set `isDefault = true` on the chosen doc
 * 3) Update user doc defaultPaymentMethodId
 * 4) Optionally also set Stripe invoice_settings.default_payment_method
 */
async function handleSetDefaultPaymentMethod(userId: string, docId: string) {
  if (!docId) {
    return errorResponse('Payment method doc ID is required to set default');
  }

  try {
    // Ensure user exists
    const { data } = await ensureUserExists(userId);
    const userData = data || {}; // Ensure userData is always an object
    
    let stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      return errorResponse(
        'Cannot set default - user has no stripeCustomerId. Save a method first.',
        400
      );
    }

    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const allSnap = await paymentMethodsRef.get();
    const batch = db.batch();

    let newDefaultStripeId: string | null = null;

    allSnap.forEach((doc) => {
      const data = doc.data() as PaymentMethod;
      if (doc.id === docId) {
        batch.update(doc.ref, { isDefault: true });
        // Fix the type error by extracting the payment method ID safely
        const pmId = data.id || data.stripeId;
        if (pmId) {
          newDefaultStripeId = pmId; // The actual Stripe PaymentMethod ID
        } else {
          console.error(`Payment method ${doc.id} is missing both id and stripeId fields`);
        }
      } else if (data.isDefault) {
        batch.update(doc.ref, { isDefault: false });
      }
    });

    if (!newDefaultStripeId) {
      return errorResponse('Unable to find doc or missing PaymentMethod.id in Firestore doc', 404);
    }

    // Update user doc's defaultPaymentMethodId
    batch.update(db.collection("users").doc(userId), { 
      defaultPaymentMethodId: newDefaultStripeId,
      updatedAt: new Date().toISOString()
    });

    // Optionally, set this as default in Stripe
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: newDefaultStripeId },
    });

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
    // Ensure user exists first
    await ensureUserExists(userId);
    
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
    // Ensure user exists
    const { data } = await ensureUserExists(userId);
    const userData = data || {}; // Ensure userData is always an object
    
    let stripeCustomerId = userData.stripeCustomerId;
    
    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const newCustomer = await stripe.customers.create({
        metadata: { userId },
      });
      stripeCustomerId = newCustomer.id;
      
      // Update the user doc
      await db.collection("users").doc(userId).update({
        stripeCustomerId,
        updatedAt: new Date().toISOString()
      });
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: stripeCustomerId,
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
