import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebase';
import { 
  doc, 
  setDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';

// Type definitions
interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface CreatePaymentIntentData {
  amount: number;
  currency?: string;
  paymentMethodId: string;
  userId: string;
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
  return NextResponse.json({ error: message }, { status });
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
    const stripe = checkStripe();
    const { action, ...data } = await request.json();

    switch (action) {
      case 'save-payment-method':
        return handleSavePaymentMethod(data);
      case 'create-payment-intent':
        return handleCreatePaymentIntent(data, stripe);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

// GET route handler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    if (!userId) {
      return errorResponse('User ID is required');
    }

    switch (action) {
      case 'get-payment-methods':
        return handleGetPaymentMethods(userId);
      default:
        return errorResponse('Invalid action');
    }
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// DELETE route handler
export async function DELETE(request: NextRequest) {
  try {
    const { action, userId, paymentMethodId } = await request.json();

    if (action !== 'delete-payment-method') {
      return errorResponse('Invalid action');
    }

    if (!userId || !paymentMethodId) {
      return errorResponse('Missing required fields');
    }

    return handleDeletePaymentMethod(userId, paymentMethodId);
  } catch (error) {
    console.error('API Error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// Handler Functions
async function handleSavePaymentMethod({ userId, paymentMethod }: { userId: string; paymentMethod: PaymentMethod }) {
  if (!userId || !paymentMethod) {
    return errorResponse('Missing required fields');
  }

  try {
    const paymentMethodRef = doc(collection(db, 'users', userId, 'paymentMethods'));
    await setDoc(paymentMethodRef, {
      id: paymentMethod.id,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      expMonth: paymentMethod.expMonth,
      expYear: paymentMethod.expYear,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      paymentMethod
    });
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

    return NextResponse.json({
      success: true,
      paymentMethods
    });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return errorResponse('Failed to get payment methods', 500);
  }
}

async function handleDeletePaymentMethod(userId: string, paymentMethodId: string) {
  try {
    // Delete from Firebase
    const paymentMethodRef = doc(db, 'users', userId, 'paymentMethods', paymentMethodId);
    await deleteDoc(paymentMethodRef);

    // If you also want to delete from Stripe, uncomment and modify below
    // const stripe = checkStripe();
    // await stripe.paymentMethods.detach(paymentMethodId);

    return NextResponse.json({
      success: true
    });
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
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      customer: userId, // Assuming userId is also the Stripe customer ID
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${appUrl}/booking/confirmation`,
      metadata: {
        userId // Store user ID in metadata for reference
      }
    });

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return errorResponse(error.message, 402); // 402 Payment Required
    }
    console.error('Payment intent creation error:', error);
    return errorResponse('Failed to create payment intent', 500);
  }
}
