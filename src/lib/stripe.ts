// src/lib/stripe.ts

import { Stripe, loadStripe } from "@stripe/stripe-js";
import { auth } from "./firebase"; // from your existing client firebase.ts

// Reuse or store the loaded Stripe instance
let stripePromise: Promise<Stripe | null>;
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
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
    return { success: false, error: "No user is logged in" };
  }

  const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);

  const res = await fetch(`/api/stripe?action=get-payment-methods&userId=${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  // data will have { success: boolean, paymentMethods: [...], error?: ... }

  if (!data.success) {
    return { success: false, error: data.error || "Failed to fetch methods" };
  }

  return { success: true, data: data.paymentMethods as SavedPaymentMethod[] };
}

/**
 * Saves a new payment method in Firestore (and optionally attach to Stripe customer).
 */
export async function savePaymentMethod(
  userId: string,
  paymentMethod: Omit<SavedPaymentMethod, "docId">
) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }

  const token = await auth.currentUser.getIdToken(true);

  const res = await fetch("/api/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "save-payment-method",
      userId,
      paymentMethod,
    }),
  });

  const data = await res.json();
  // data will have { success: boolean, paymentMethod: {...}, error?: ... }

  if (!data.success) {
    return { success: false, error: data.error || "Failed to save method" };
  }

  return { success: true, paymentMethod: data.paymentMethod as SavedPaymentMethod };
}

/**
 * Deletes a payment method in Firestore.
 */
export async function deletePaymentMethod(userId: string, paymentMethodId: string) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }

  const token = await auth.currentUser.getIdToken(true);

  const res = await fetch("/api/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "delete-payment-method",
      userId,
      paymentMethodId,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to delete method" };
  }

  return { success: true };
}

/* -------------------------------------------------------------------------
   NEW METHODS: Update payment methods, set default, 
   and user balance methods (get / top up).
   ------------------------------------------------------------------------- */

/**
 * Updates a payment method in Firestore (e.g. toggling isDefault).
 * This assumes your /api/stripe route supports an "update-payment-method" action.
 */
export async function updatePaymentMethod(
  userId: string,
  paymentMethodId: string,
  updates: Partial<SavedPaymentMethod>
) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }

  const token = await auth.currentUser.getIdToken(true);

  const res = await fetch("/api/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "update-payment-method",
      userId,
      paymentMethodId,
      updates,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to update payment method" };
  }

  return { success: true };
}

/**
 * Sets one payment method as the default for the user.
 * On the server, you'd typically unmark other methods.
 */
export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
  // Just a wrapper that calls updatePaymentMethod
  return updatePaymentMethod(userId, paymentMethodId, { isDefault: true });
}

/**
 * Retrieves the user's current balance (e.g. "Mass Transit Cash").
 * Points to a /api/user-balance route or similar.
 */
export async function getUserBalance(userId: string) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }

  const token = await auth.currentUser.getIdToken(true);

  // Suppose you have a route /api/user-balance?action=get-balance&userId=...
  const res = await fetch(`/api/user-balance?action=get-balance&userId=${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to fetch user balance" };
  }

  return { success: true, balance: data.balance as number };
}

/**
 * Increases the user's balance (top-up).
 * For real billing, you'd do a Stripe PaymentIntent on the server side before updating the balance.
 */
export async function topUpBalance(userId: string, amount: number) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  if (amount <= 0) {
    return { success: false, error: "Top-up amount must be greater than 0" };
  }

  const token = await auth.currentUser.getIdToken(true);

  // Suppose you have a route /api/user-balance that accepts a POST with action="top-up"
  const res = await fetch("/api/user-balance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "top-up",
      userId,
      amount,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to top up" };
  }

  return { success: true, newBalance: data.newBalance as number };
}
