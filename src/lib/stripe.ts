import { loadStripe, Stripe } from '@stripe/stripe-js';

// Environment variable check
const getPublishableKey = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.error('Stripe publishable key is not set in environment variables');
    return '';
  }
  return key;
};

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = getPublishableKey();
    if (!publishableKey) {
      throw new Error('Stripe publishable key is required');
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// Types for payment methods
export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

// Payment Intent types
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

// API response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Function to save payment method to Firebase/Backend
export const savePaymentMethod = async (
  userId: string, 
  paymentMethod: SavedPaymentMethod
): Promise<ApiResponse<SavedPaymentMethod>> => {
  try {
    const response = await fetch('/api/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'save-payment-method',
        userId,
        paymentMethod,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to save payment method');
    }
    
    return {
      success: true,
      data: data.paymentMethod,
    };
  } catch (error) {
    console.error('Error saving payment method:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

// Function to get saved payment methods
export const getSavedPaymentMethods = async (
  userId: string
): Promise<ApiResponse<SavedPaymentMethod[]>> => {
  try {
    const response = await fetch(`/api/stripe?action=get-payment-methods&userId=${userId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get payment methods');
    }

    return {
      success: true,
      data: data.paymentMethods,
    };
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

// Function to delete a payment method
export const deletePaymentMethod = async (
  userId: string, 
  paymentMethodId: string
): Promise<ApiResponse<void>> => {
  try {
    const response = await fetch('/api/stripe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete-payment-method',
        userId,
        paymentMethodId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete payment method');
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting payment method:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

// Function to create a payment intent
export const createPaymentIntent = async (
  params: CreatePaymentIntentParams
): Promise<ApiResponse<PaymentIntentResponse>> => {
  try {
    const response = await fetch('/api/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create-payment-intent',
        ...params,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create payment intent');
    }

    return {
      success: true,
      data: {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
      },
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};
