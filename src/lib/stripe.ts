// src/lib/stripe.ts

import { Stripe, loadStripe } from "@stripe/stripe-js";
import { auth } from "./firebase";

// Reuse or store the loaded Stripe instance
let stripePromise: Promise<Stripe | null>;
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  }
  return stripePromise;
}

/**
 * Represents a payment method doc from Firestore,
 * but "id" is the Firestore doc ID, and we add "stripeId" for the actual Stripe PaymentMethod ID.
 */
export interface SavedPaymentMethod {
  // Firestore doc ID (for delete / set-default):
  id: string;

  // Actual Stripe PaymentMethod ID (if you need it):
  stripeId?: string;

  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

/**
 * Fetches saved payment methods for the given userId from your Next.js route.
 * NOTE: The server returns { docId, id, brand, ... }. We rename docId -> id for Firestore doc ID,
 * and put the original 'id' (the Stripe PM ID) into 'stripeId'.
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
  // Server returns: { success, paymentMethods: [ { docId, id (Stripe), brand, last4, expMonth... }, ... ] }

  if (!data.success) {
    return { success: false, error: data.error || "Failed to fetch methods" };
  }

  // Map server's docId => front-end's "id"
  const mapped = data.paymentMethods.map((pm: any) => ({
    id: pm.docId,         // Firestore doc ID (used for delete, setDefault)
    stripeId: pm.id,      // keep the actual Stripe PaymentMethod ID in stripeId
    brand: pm.brand,
    last4: pm.last4,
    expMonth: pm.expMonth,
    expYear: pm.expYear,
    isDefault: pm.isDefault,
  })) as SavedPaymentMethod[];

  return { success: true, data: mapped };
}

/**
 * Saves a new payment method in Firestore (and optionally attach to Stripe customer).
 * "paymentMethod" contains Stripe ID, brand, last4, etc. On the server, we create a new doc.
 */
export async function savePaymentMethod(
  userId: string,
  paymentMethod: SavedPaymentMethod
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
      paymentMethod, // note: the server expects .id to be the Stripe PM ID here
    }),
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to save method" };
  }

  // The server response might not return docId, or might just return partial info.
  // If you need the new doc ID, you'd do something similar to the GET mapping.
  return { success: true, paymentMethod: data.paymentMethod as Omit<SavedPaymentMethod, "id"> };
}

/**
 * Deletes a payment method doc in Firestore by doc ID.
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
      paymentMethodId, // pass doc ID
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
 * Updates a payment method doc in Firestore (e.g. toggling isDefault).
 * This assumes your /api/stripe route supports an "update-payment-method" action,
 * but you are actually using "set-default-payment-method" in your code.
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
      paymentMethodId, // doc ID
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
 * This calls the server's "set-default-payment-method" action,
 * which expects the doc ID, not the Stripe ID.
 */
export async function setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
  // If your server uses "set-default-payment-method" action,
  // you must call that directly rather than "update-payment-method".
  // But here's a wrapper approach:
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
      action: "set-default-payment-method",
      userId,
      paymentMethodId, // doc ID
    }),
  });

  const data = await res.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to set default payment method" };
  }

  return { success: true };
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

  const res = await fetch(`/api/user-balance?action=get-balance&userId=${userId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
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
