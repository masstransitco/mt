// src/app/api/user-balance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth as adminAuth, db, topUpUserBalance } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    // parse query from the URL
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");

    // read the Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return NextResponse.json({ success: false, error: "Invalid Authorization header" }, { status: 401 });
    }

    // verify the token
    const decoded = await adminAuth.verifyIdToken(token);
    if (!userId || decoded.uid !== userId) {
      return NextResponse.json({ success: false, error: "User mismatch or missing userId" }, { status: 403 });
    }

    // handle get-balance
    if (action === "get-balance") {
      const userRef = db.collection("users").doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ success: false, error: "User does not exist" }, { status: 404 });
      }
      const userData = userSnap.data() || {};
      const balance = userData.balance || 0;
      return NextResponse.json({ success: true, balance }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[GET user-balance] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Missing Authorization header" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return NextResponse.json({ success: false, error: "Invalid Authorization header" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(token);

    const body = await req.json();
    const { action, userId, amount } = body;
    if (!userId || decoded.uid !== userId) {
      return NextResponse.json({ success: false, error: "User mismatch or missing userId" }, { status: 403 });
    }

    // handle top-up
    if (action === "top-up") {
      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, error: "Invalid or missing top-up amount" }, { status: 400 });
      }
      const newBalance = await topUpUserBalance(userId, amount);
      return NextResponse.json({ success: true, newBalance }, { status: 200 });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[POST user-balance] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Server Error" }, { status: 500 });
  }
}
