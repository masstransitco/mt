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
  id?: string;       // The Stripe PaymentMethod ID
  stripeId?: string; // Alternative field name for the Stripe PaymentMethod ID
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

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// Helper to create user document if it doesn't exist
async function ensureUserExists(userId: string) {
  const userRef = db.collection('users').doc(userId);
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
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Helper for success responses
function successResponse(data: any) {
  return NextResponse.json({ success: true, ...data });
}

// ----------------------------------------------------------------------------
// ROUTE HANDLERS
// ----------------------------------------------------------------------------

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
        return await handleSavePaymentMethod({
          userId,
          paymentMethod: data.paymentMethod,
        });

      case 'delete-payment-method':
        return await handleDeletePaymentMethod(userId, data.paymentMethodId);

      case 'set-default-payment-method':
        // data.paymentMethodId is the Firestore doc ID
        return await handleSetDefaultPaymentMethod(userId, data.paymentMethodId);

      case 'create-payment-intent':
        return await handleCreatePaymentIntent({ ...data, userId });

      // Example: charging the user for a trip
      case 'charge-user-for-trip':
        return await handleChargeUserForTrip(userId, data.amount);

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

// ----------------------------------------------------------------------------
// ACTION HANDLERS
// ----------------------------------------------------------------------------

/**
 * Save a payment method to Firestore for the user.
 * 1) Ensure the user has a Stripe Customer (create if needed).
 * 2) Attach the PaymentMethod to that Customer in Stripe.
 * 3) If it's the user's first card or paymentMethod.isDefault === true,
 *    make it the default and unset default on others.
 * 4) Otherwise just create the doc as a non-default method.
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
    // 1) Ensure user doc & Stripe customer exist
    const { data: userData } = await ensureUserExists(userId);
    let stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const newCustomer = await stripe.customers.create({
        metadata: { userId },
        // optional: email: userData.email,
      });
      stripeCustomerId = newCustomer.id;
      await db
        .collection('users')
        .doc(userId)
        .update({
          stripeCustomerId,
          updatedAt: new Date().toISOString(),
        });
    }

    // 2) Attach PaymentMethod to Stripe customer
    const paymentMethodId = paymentMethod.stripeId || paymentMethod.id;
    if (!paymentMethodId) {
      return errorResponse('Payment method ID is required', 400);
    }
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
    } catch (err: any) {
      if (err.code === 'resource_already_exists') {
        console.log(
          `Payment method ${paymentMethodId} already attached to customer ${stripeCustomerId}`
        );
      } else {
        throw err;
      }
    }

    // 3) Decide if we should make this card default
    const paymentMethodsRef = db.collection(`users/${userId}/paymentMethods`);
    const snapshot = await paymentMethodsRef.get();
    const isFirst = snapshot.empty;
    const shouldMakeDefault = isFirst || paymentMethod.isDefault === true;

    if (shouldMakeDefault) {
      // (a) Update Stripe's invoice_settings.default_payment_method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      // (b) Batch unset isDefault on all other docs, create/update the new doc as default,
      //     and update the user doc's defaultPaymentMethodId
      const batch = db.batch();

      snapshot.forEach((docSnap) => {
        if (docSnap.id !== paymentMethodId) {
          batch.update(docSnap.ref, { isDefault: false });
        }
      });

      const newPaymentMethodRef = paymentMethodsRef.doc(paymentMethodId);
      batch.set(
        newPaymentMethodRef,
        {
          ...paymentMethod,
          id: paymentMethodId,
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      batch.update(db.collection('users').doc(userId), {
        defaultPaymentMethodId: paymentMethodId,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      return successResponse({
        paymentMethod: {
          ...paymentMethod,
          id: paymentMethodId,
          isDefault: true,
        },
      });
    } else {
      // 4) Otherwise, just create it as a non-default doc
      const newPaymentMethodRef = paymentMethodsRef.doc(paymentMethodId);
      await newPaymentMethodRef.set({
        ...paymentMethod,
        id: paymentMethodId,
        isDefault: false,
        createdAt: new Date().toISOString(),
      });

      return successResponse({
        paymentMethod: {
          ...paymentMethod,
          id: paymentMethodId,
          isDefault: false,
        },
      });
    }
  } catch (error: any) {
    console.error('Error saving payment method:', error);
    return errorResponse(error.message || 'Failed to save payment method', 500);
  }
}

/**
 * Delete a payment method doc from Firestore for the user.
 */
async function handleDeletePaymentMethod(
  userId: string,
  paymentMethodId: string
) {
  if (!paymentMethodId) {
    return errorResponse('Payment method ID is required');
  }

  try {
    await ensureUserExists(userId);

    await db
      .collection(`users/${userId}/paymentMethods`)
      .doc(paymentMethodId)
      .delete();

    // OPTIONAL: If this was the default, you might also want to
    // unset defaultPaymentMethodId in user doc, or choose a new default.

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
    const { data: userData } = await ensureUserExists(userId);
    const stripeCustomerId = userData.stripeCustomerId;
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

    allSnap.forEach((docSnap) => {
      const pmData = docSnap.data() as PaymentMethod;
      if (docSnap.id === docId) {
        batch.update(docSnap.ref, { isDefault: true });
        // The actual Stripe PaymentMethod ID
        const pmId = pmData.id || pmData.stripeId;
        if (pmId) {
          newDefaultStripeId = pmId;
        } else {
          console.error(
            `Payment method ${docSnap.id} is missing both id and stripeId fields`
          );
        }
      } else if (pmData.isDefault) {
        batch.update(docSnap.ref, { isDefault: false });
      }
    });

    if (!newDefaultStripeId) {
      return errorResponse(
        'Unable to find doc or missing PaymentMethod.id in Firestore doc',
        404
      );
    }

    // Update user doc's defaultPaymentMethodId
    batch.update(db.collection('users').doc(userId), {
      defaultPaymentMethodId: newDefaultStripeId,
      updatedAt: new Date().toISOString(),
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
 * Create a PaymentIntent with Stripe (manual confirmation flow).
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
    const { data: userData } = await ensureUserExists(userId);
    let stripeCustomerId = userData.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create a new Stripe customer
      const newCustomer = await stripe.customers.create({
        metadata: { userId },
      });
      stripeCustomerId = newCustomer.id;

      // Update user doc
      await db.collection('users').doc(userId).update({
        stripeCustomerId,
        updatedAt: new Date().toISOString(),
      });
    }

    // Create PaymentIntent (manual confirmation)
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
      status: paymentIntent.status,
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
 * Directly charge the user's default PaymentMethod (or provided PM) for an amount.
 *  - If user doesn't have a defaultPaymentMethodId or we can't find it, throw an error.
 *  - We create a PaymentIntent with confirm: true so it finalizes immediately (auto-confirm).
 *  - If 3D Secure is needed, it may require_action => you handle or fail in a real scenario.
 */
async function handleChargeUserForTrip(
  userId: string,
  amount: number | undefined
) {
  if (!amount || amount <= 0) {
    return errorResponse('A valid amount is required to charge the user.', 400);
  }

  // Attempt to load user doc & see if they have defaultPaymentMethodId
  const { data: userData } = await ensureUserExists(userId);
  const stripeCustomerId = userData.stripeCustomerId;
  const defaultPmId = userData.defaultPaymentMethodId;

  if (!stripeCustomerId || !defaultPmId) {
    return errorResponse(
      'User has no Stripe customer or default payment method. Cannot charge user.',
      400
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'hkd', // or your desired currency
      customer: stripeCustomerId,
      payment_method: defaultPmId,
      off_session: true, // for off-session usage
      confirm: true, // automatically confirm
      metadata: { userId },
    });

    // Check if it succeeded or requires action
    if (
      paymentIntent.status === 'requires_action' ||
      paymentIntent.status === 'requires_payment_method'
    ) {
      // The payment requires 3D Secure or a new payment method
      return errorResponse(
        'Payment requires additional user action (3D Secure).',
        402
      );
    }

    // Otherwise, success
    return successResponse({
      message: `Successfully charged HK$${(amount / 100).toFixed(2)} to user’s default payment method.`,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error: any) {
    if (error instanceof Stripe.errors.StripeError) {
      // Return a 402 for Stripe card/validation errors
      return errorResponse(error.message, 402);
    }
    console.error('Error charging user for trip:', error);
    return errorResponse('Failed to charge user for trip', 500);
  }
}
