// src/lib/stripe.ts
import { Stripe, loadStripe } from '@stripe/stripe-js';
import { auth } from './firebase'; // from your existing client firebase.ts

// Reuse or store the loaded Stripe instance
let stripePromise: Promise<Stripe | null>;
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
}

/**
 * Shape of the saved payment method data from Firestore.
 */
export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
  // docId? if needed, or other fields from Firestore
}

/**
 * Fetches saved payment methods for the given userId from your Next.js route.
 */
export async function getSavedPaymentMethods(userId: string) {
  if (!auth.currentUser) {
    return { success: false, error: 'No user is logged in' };
  }

  const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);

  const res = await fetch(`/api/stripe?action=get-payment-methods&userId=${userId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    }
  });

  const data = await res.json();
  // data will have { success: boolean, paymentMethods: [...], error?: ... }

  if (!data.success) {
    return { success: false, error: data.error || 'Failed to fetch methods' };
  }

  return { success: true, data: data.paymentMethods as SavedPaymentMethod[] };
}

/**
 * Saves a new payment method in Firestore (and optionally attach to Stripe customer).
 */
export async function savePaymentMethod(
  userId: string,
  paymentMethod: Omit<SavedPaymentMethod, 'docId'>
) {
  if (!auth.currentUser) {
    return { success: false, error: 'No user is logged in' };
  }

  const token = await auth.currentUser.getIdToken(true);

  const res = await fetch('/api/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'save-payment-method',
      userId,
      paymentMethod,
    }),
  });

  const data = await res.json();
  // data will have { success: boolean, paymentMethod: {...}, error?: ... }

  if (!data.success) {
    return { success: false, error: data.error || 'Failed to save method' };
  }

  return { success: true, paymentMethod: data.paymentMethod as SavedPaymentMethod };
}

/**
 * Deletes a payment method by doc ID in Firestore (if you implement a "delete" action).
 * This is *optional* if you have a `DELETE` or a `POST` with an action "delete-payment-method."
 * 
 * For now, let's assume you have a route or action for deletion. 
 * If your code is different, adjust accordingly.
 */
export async function deletePaymentMethod(userId: string, paymentMethodId: string) {
  if (!auth.currentUser) {
    return { success: false, error: 'No user is logged in' };
  }

  const token = await auth.currentUser.getIdToken(true);

  // If you have a dedicated route or just do it in "stripe" route with a new action:
  const res = await fetch('/api/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'delete-payment-method',
      userId,
      paymentMethodId,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || 'Failed to delete method' };
  }

  return { success: true };
}
