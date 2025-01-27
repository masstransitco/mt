import { loadStripe, Stripe } from '@stripe/stripe-js';
import { auth } from '@/lib/firebase';

// Custom error classes
export class FirebasePermissionError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'FirebasePermissionError';
  }
}

export class StripeConfigError extends Error {
  constructor(message: string = 'Stripe configuration error') {
    super(message);
    this.name = 'StripeConfigError';
  }
}

// Helper function to get auth token
const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// Environment variable check
const getPublishableKey = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new StripeConfigError('Stripe publishable key is not set in environment variables');
  }
  return key;
};

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    try {
      const publishableKey = getPublishableKey();
      stripePromise = loadStripe(publishableKey);
    } catch (error) {
      console.error('Stripe initialization error:', error);
      throw error;
    }
  }
  return stripePromise;
};

// Types
export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  paymentMethodId: string;
  userId: string;
}

export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Helper function to check authentication
const checkAuth = () => {
  if (!auth.currentUser) {
    throw new FirebasePermissionError('User must be authenticated');
  }
  return auth.currentUser.uid;
};

// Helper function to handle API responses
const handleApiResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 403) {
      throw new FirebasePermissionError(data.error || 'Permission denied');
    }
    throw new Error(data.error || 'API request failed');
  }

  return {
    success: true,
    data: data.data || data
  };
};

// Helper function to handle errors
const handleError = (error: unknown): ApiResponse<never> => {
  console.error('API Error:', error);

  if (error instanceof FirebasePermissionError) {
    return {
      success: false,
      error: 'Authentication required. Please sign in again.'
    };
  }

  if (error instanceof StripeConfigError) {
    return {
      success: false,
      error: 'Payment system configuration error. Please try again later.'
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : 'An unknown error occurred'
  };
};

// Function to save payment method
export const savePaymentMethod = async (
  userId: string, 
  paymentMethod: SavedPaymentMethod
): Promise<ApiResponse<SavedPaymentMethod>> => {
  try {
    checkAuth();
    const headers = await getAuthHeaders();

    if (!userId || !paymentMethod) {
      throw new Error('User ID and payment method are required');
    }

    const response = await fetch('/api/stripe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'save-payment-method',
        userId,
        paymentMethod,
      }),
    });
    
    return await handleApiResponse<SavedPaymentMethod>(response);
  } catch (error) {
    return handleError(error);
  }
};

// Function to get saved payment methods
export const getSavedPaymentMethods = async (
  userId: string
): Promise<ApiResponse<SavedPaymentMethod[]>> => {
  try {
    checkAuth();
    const headers = await getAuthHeaders();

    if (!userId) {
      throw new Error('User ID is required');
    }

    const response = await fetch(
      `/api/stripe?action=get-payment-methods&userId=${encodeURIComponent(userId)}`,
      { headers }
    );
    
    return await handleApiResponse<SavedPaymentMethod[]>(response);
  } catch (error) {
    return handleError(error);
  }
};

// Function to delete payment method
export const deletePaymentMethod = async (
  userId: string, 
  paymentMethodId: string
): Promise<ApiResponse<void>> => {
  try {
    checkAuth();
    const headers = await getAuthHeaders();

    if (!userId || !paymentMethodId) {
      throw new Error('User ID and payment method ID are required');
    }

    const response = await fetch('/api/stripe', {
      method: 'DELETE',
      headers,
      body: JSON.stringify({
        action: 'delete-payment-method',
        userId,
        paymentMethodId,
      }),
    });

    return await handleApiResponse<void>(response);
  } catch (error) {
    return handleError(error);
  }
};

// Function to create payment intent
export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<ApiResponse<PaymentIntentResponse>> => {
  try {
    checkAuth();
    const headers = await getAuthHeaders();

    if (!params.amount || !params.paymentMethodId || !params.userId) {
      throw new Error('Amount, payment method, and user ID are required');
    }

    const response = await fetch('/api/stripe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'create-payment-intent',
        ...params,
      }),
    });

    return await handleApiResponse<PaymentIntentResponse>(response);
  } catch (error) {
    return handleError(error);
  }
};
