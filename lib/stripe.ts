// src/lib/stripe.ts

import { Stripe, loadStripe } from "@stripe/stripe-js";
import { auth } from "./firebase";

/** 
 * Lazy-load a Stripe instance for front-end usage (Elements, PaymentIntents, etc.). 
 */
let stripePromise: Promise<Stripe | null>;
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
  }
  return stripePromise;
}

/**
 * A Firestore-based PaymentMethod doc:
 *   - `id`: the **Firestore doc ID** used for delete, set-default, etc.
 *   - `stripeId`: the actual Stripe PaymentMethod ID in Stripe
 *   - brand, last4, expMonth, expYear
 */
export interface SavedPaymentMethod {
  id: string;          // Firestore doc ID
  stripeId: string;    // The actual Stripe PaymentMethod ID in Stripe
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

/**
 * When adding a new PaymentMethod, we only provide
 * the Stripe PaymentMethod ID (`stripeId`) plus the card details.
 * Firestore doc ID `id` is generated on the server.
 */
export interface PaymentMethodInput {
  stripeId: string;   // The newly created Stripe PaymentMethod ID
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

/**
 * Fetches saved payment methods from `/api/stripe?action=get-payment-methods`.
 */
export async function getSavedPaymentMethods(userId: string) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }

  const token = await auth.currentUser.getIdToken(true);

  const res = await fetch(
    `/api/stripe?action=get-payment-methods&userId=${userId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();

  if (!data.success) {
    return { success: false, error: data.error || "Failed to fetch methods" };
  }

  // The server returns objects like { docId, id, brand, last4, expMonth, expYear, isDefault }
  // Where docId is the Firestore doc ID, and id is the Stripe PaymentMethod ID.
  // We rename them to match our SavedPaymentMethod interface:
  const paymentMethods = data.paymentMethods.map((pm: any) => ({
    id: pm.docId,        // Firestore doc ID
    stripeId: pm.id,     // The Stripe PaymentMethod ID from the server
    brand: pm.brand,
    last4: pm.last4,
    expMonth: pm.expMonth,
    expYear: pm.expYear,
    isDefault: pm.isDefault,
  })) as SavedPaymentMethod[];

  return { success: true, data: paymentMethods };
}

/**
 * Saves a newly created card in Firestore. 
 */
export async function savePaymentMethod(
  userId: string,
  paymentMethod: PaymentMethodInput
) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  const token = await auth.currentUser.getIdToken(true);

  console.log("[savePaymentMethod] Request body =>", { userId, paymentMethod });

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
  console.log("[savePaymentMethod] Server response =>", data);

  if (!data.success) {
    return { success: false, error: data.error || "Failed to save method" };
  }
  return { success: true, paymentMethod: data.paymentMethod };
}

/**
 * Deletes a PaymentMethod doc in Firestore by doc ID.
 */
export async function deletePaymentMethod(userId: string, docId: string) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  const token = await auth.currentUser.getIdToken(true);

  console.log("[deletePaymentMethod] Request body =>", { userId, docId });

  const res = await fetch("/api/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "delete-payment-method",
      userId,
      paymentMethodId: docId,
    }),
  });

  const data = await res.json();
  console.log("[deletePaymentMethod] Server response =>", data);

  if (!data.success) {
    return { success: false, error: data.error || "Failed to delete method" };
  }
  return { success: true };
}

/**
 * Set a payment method as default for the user (doc ID).
 */
export async function setDefaultPaymentMethod(userId: string, docId: string) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  const token = await auth.currentUser.getIdToken(true);

  console.log("[setDefaultPaymentMethod] Request body =>", { userId, docId });

  const res = await fetch("/api/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "set-default-payment-method",
      userId,
      paymentMethodId: docId,
    }),
  });

  const data = await res.json();
  console.log("[setDefaultPaymentMethod] Server response =>", data);

  if (!data.success) {
    return { success: false, error: data.error || "Failed to set default" };
  }
  return { success: true };
}

/**
 * Retrieve user balance (example call to /api/user-balance).
 */
export async function getUserBalance(userId: string) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  const token = await auth.currentUser.getIdToken(true);

  console.log("[getUserBalance] fetching =>", { userId });

  const res = await fetch(`/api/user-balance?action=get-balance&userId=${userId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  console.log("[getUserBalance] Server response =>", data);

  if (!data.success) {
    return { success: false, error: data.error || "Failed to fetch user balance" };
  }
  return { success: true, balance: data.balance as number };
}

/**
 * Perform a top-up by calling /api/user-balance with action="top-up".
 */
export async function topUpBalance(userId: string, amount: number) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  if (amount <= 0) {
    return { success: false, error: "Top-up amount must be > 0" };
  }

  const token = await auth.currentUser.getIdToken(true);

  console.log("[topUpBalance] Request body =>", { userId, amount });

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
  console.log("[topUpBalance] Server response =>", data);

  if (!data.success) {
    return { success: false, error: data.error || "Failed to top up" };
  }
  return { success: true, newBalance: data.newBalance as number };
}

/**
 * chargeUserForTrip - direct charge off-session to user's default PM
 */
export async function chargeUserForTrip(userId: string, amountInCents: number) {
  if (!auth.currentUser) {
    return { success: false, error: "No user is logged in" };
  }
  if (amountInCents <= 0) {
    return { success: false, error: "Charge amount must be > 0" };
  }

  console.log("[chargeUserForTrip] Request =>", {
    userId,
    amountInCents,
  });

  const token = await auth.currentUser.getIdToken(true);
  const res = await fetch("/api/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "charge-user-for-trip",
      userId,
      amount: amountInCents,
    }),
  });

  const data = await res.json();
  console.log("[chargeUserForTrip] Response =>", data);

  if (!data.success) {
    return { success: false, error: data.error || "Failed to charge user" };
  }
  return { success: true, ...data };
}
