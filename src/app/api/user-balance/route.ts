// src/app/api/user-balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db } from "@/lib/firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

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
    return { exists: false, data: { balance: 0 } };
  }
  
  return { exists: true, data: userSnap.data() };
}

// Helper to top up user balance - moved to internal function, not exported
async function topUpUserBalance(userId: string, amount: number): Promise<number> {
  const userRef = db.collection("users").doc(userId);
  
  // Get current balance
  const { exists, data } = await ensureUserExists(userId);
  const currentBalance = data?.balance || 0;
  
  // Add amount to balance
  const newBalance = currentBalance + amount;
  await userRef.update({ balance: newBalance });
  
  return newBalance;
}

export async function GET(req: NextRequest) {
  try {
    // parse query from the URL
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");

    // read the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Missing Authorization header" },
        { status: 401 }
      );
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Invalid Authorization header" },
        { status: 401 }
      );
    }

    // verify the token
    const decoded = await adminAuth.verifyIdToken(token);
    if (!userId || decoded.uid !== userId) {
      return NextResponse.json(
        { success: false, error: "User mismatch or missing userId" },
        { status: 403 }
      );
    }

    // handle get-balance
    if (action === "get-balance") {
      // Get or create user document
      const { data } = await ensureUserExists(userId);
      const balance = data?.balance || 0;
      
      return NextResponse.json({ success: true, balance }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[GET user-balance] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Missing Authorization header" },
        { status: 401 }
      );
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Invalid Authorization header" },
        { status: 401 }
      );
    }
    const decoded = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const { action, userId, amount } = body;
    if (!userId || decoded.uid !== userId) {
      return NextResponse.json(
        { success: false, error: "User mismatch or missing userId" },
        { status: 403 }
      );
    }

    // handle top-up
    if (action === "top-up") {
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid or missing top-up amount" },
          { status: 400 }
        );
      }

      // 1) Fetch the user doc to get stripeCustomerId and defaultPaymentMethodId
      const { exists, data: userData } = await ensureUserExists(userId);

      // If no stripeCustomerId, create it now
      let stripeCustomerId = userData.stripeCustomerId;
      if (!stripeCustomerId) {
        const newCustomer = await stripe.customers.create({
          // Optional: pass in user's email, name, etc. if you have them
          metadata: { userId },
        });
        stripeCustomerId = newCustomer.id;

        // Store in user doc
        await db.collection("users").doc(userId).update({ 
          stripeCustomerId,
          updatedAt: new Date().toISOString()
        });
      }

      // Next, ensure we have a default payment method
      const defaultPaymentMethodId = userData.defaultPaymentMethodId;
      if (!defaultPaymentMethodId) {
        return NextResponse.json(
          { success: false, error: "No default payment method to charge." },
          { status: 400 }
        );
      }

      // 2) Create a PaymentIntent with the default PaymentMethod
      let paymentIntent;
      try {
        const amountInCents = Math.round(amount * 100); // Convert e.g. $10 -> 1000 cents
        paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd", // or "hkd", etc.
          customer: stripeCustomerId,
          payment_method: defaultPaymentMethodId,
          off_session: true,
          confirm: true,
        });
      } catch (err: any) {
        console.error("Error creating PaymentIntent:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }

      // 3) Check if PaymentIntent succeeded
      if (paymentIntent.status !== "succeeded") {
        return NextResponse.json(
          {
            success: false,
            error: `Payment did not succeed. Status: ${paymentIntent.status}`,
          },
          { status: 400 }
        );
      }

      // 4) Payment success => increment the user's Firestore balance
      const newBalance = await topUpUserBalance(userId, amount);
      return NextResponse.json({ success: true, newBalance }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[POST user-balance] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server Error" },
      { status: 500 }
    );
  }
}
