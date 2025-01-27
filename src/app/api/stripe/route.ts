import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebase-admin';
import { auth } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { 
  doc, 
  setDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  getDoc 
} from 'firebase/firestore';

// Type definitions
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

// Auth middleware
async function verifyAuth(req: NextRequest) {
  const headersList = headers();
  const authHeader = headersList.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization token');
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Auth error:', error);
    throw new Error('Invalid authorization token');
  }
}

// Verify environment variables
const validateEnvVariables = () => {
  const required = [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_APP_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// Initialize Stripe with validation
let stripeInstance: Stripe | null = null;
try {
  validateEnvVariables();
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
  });
} catch (error) {
  console.error('Stripe initialization error:', error);
}

// Helper for error responses
const errorResponse = (message: string, status: number = 400) => {
  return NextResponse.json(
    { success: false, error: message }, 
    { status }
  );
};

// Helper for success responses
const successResponse = (data: any) => {
  return NextResponse.json({
    success: true,
    ...data
  });
};

// Middleware to check Stripe initialization
const checkStripe = () => {
  if (!stripeInstance) {
    throw new Error('Stripe is not properly initialized');
  }
  return stripeInstance;
};

// POST route handler
export async function POST(request: NextRequest) {
  try {
    const authenticatedUserId = await verifyAuth(request);
    const stripe = checkStripe();
    const { action, userId, ...data } = await request.json();

    // Verify authenticated user matches requested userId
    if (authenticatedUserId !== userId) {
      return errorResponse('Unauthorized access', 403);
    }

    switch (action) {
      case 'save-payment-method':
        return handleSavePaymentMethod({ userId, paymentMethod: data.paymentMethod });
      case 'create-payment-intent':
        return handleCreatePaymentIntent({ ...data, userId }, stripe);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('API Error:', error);
    if (error instanceof Error && error.message.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// GET route handler
export async function GET(request: NextRequest) {
  try {
    const authenticatedUserId = await verifyAuth(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    if (!userId) {
      return errorResponse('User ID is required');
    }

    // Verify authenticated user matches requested userId
    if (authenticatedUserId !== userId) {
      return errorResponse('Unauthorized access', 403);
    }

    switch (action) {
      case 'get-payment-methods':
        return handleGetPaymentMethods(userId);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('API Error:', error);
    if (error instanceof Error && error.message.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// DELETE route handler
export async function DELETE(request: NextRequest) {
  try {
    const authenticatedUserId = await verifyAuth(request);
    const { action, userId, paymentMethodId } = await request.json();

    if (!userId || !paymentMethodId) {
      return errorResponse('Missing required fields');
    }

    // Verify authenticated user matches requested userId
    if (authenticatedUserId !== userId) {
      return errorResponse('Unauthorized access', 403);
    }

    switch (action) {
      case 'delete-payment-method':
        return handleDeletePaymentMethod(userId, paymentMethodId);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('API Error:', error);
    if (error instanceof Error && error.message.includes('auth')) {
      return errorResponse(error.message, 401);
    }
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// Handler Functions
async function handleSavePaymentMethod({ 
  userId, 
  paymentMethod 
}: { 
  userId: string; 
  paymentMethod: PaymentMethod;
}) {
  if (!userId || !paymentMethod) {
    return errorResponse('Missing required fields');
  }

  try {
    // Check if this is the first payment method (make it default)
    const paymentMethodsRef = collection(db, 'users', userId, 'paymentMethods');
    const snapshot = await getDocs(paymentMethodsRef);
    const isDefault = snapshot.empty;

    const newPaymentMethodRef = doc(paymentMethodsRef);
    await setDoc(newPaymentMethodRef, {
      id: paymentMethod.id,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      expMonth: paymentMethod.expMonth,
      expYear: paymentMethod.expYear,
      isDefault,
      createdAt: new Date().toISOString(),
    });

    return successResponse({ paymentMethod: { ...paymentMethod, isDefault } });
  } catch (error) {
    console.error('Error saving payment method:', error);
    return errorResponse('Failed to save payment method', 500);
  }
}

async function handleGetPaymentMethods(userId: string) {
  try {
    const paymentMethodsRef = collection(db, 'users', userId, 'paymentMethods');
    const q = query(paymentMethodsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const paymentMethods = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return successResponse({ paymentMethods });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return errorResponse('Failed to get payment methods', 500);
  }
}

async function handleDeletePaymentMethod(userId: string, paymentMethodId: string) {
  try {
    const stripe = checkStripe();
    const paymentMethodRef = doc(db, 'users', userId, 'paymentMethods', paymentMethodId);
    
    const paymentMethodDoc = await getDoc(paymentMethodRef);
    if (!paymentMethodDoc.exists()) {
      return errorResponse('Payment method not found', 404);
    }

    // Delete from Firebase and Stripe
    await Promise.all([
      deleteDoc(paymentMethodRef),
      stripe.paymentMethods.detach(paymentMethodId)
    ]);

    // Handle default payment method update
    const paymentMethodData = paymentMethodDoc.data();
    if (paymentMethodData?.isDefault) {
      const remainingMethods = await getDocs(
        query(
          collection(db, 'users', userId, 'paymentMethods'),
          orderBy('createdAt', 'desc')
        )
      );

      if (!remainingMethods.empty) {
        const newDefaultMethod = remainingMethods.docs[0];
        await setDoc(
          doc(db, 'users', userId, 'paymentMethods', newDefaultMethod.id),
          { ...newDefaultMethod.data(), isDefault: true },
          { merge: true }
        );
      }
    }

    return successResponse({ message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return errorResponse('Failed to delete payment method', 500);
  }
}

async function handleCreatePaymentIntent(
  { amount, currency = 'hkd', paymentMethodId, userId }: CreatePaymentIntentData,
  stripe: Stripe
) {
  if (!amount || !paymentMethodId || !userId) {
    return errorResponse('Amount, payment method, and user ID are required');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return errorResponse('App URL is not configured');
  }

  try {
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

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${appUrl}/booking/confirmation`,
      metadata: {
        userId
      }
    });

    return successResponse({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return errorResponse(error.message, 402);
    }
    console.error('Payment intent creation error:', error);
    return errorResponse('Failed to create payment intent', 500);
  }
}
