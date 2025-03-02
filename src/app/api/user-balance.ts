// pages/api/user-balance.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { auth as adminAuth, db, topUpUserBalance } from "@/lib/firebase-admin";

/**
 * Example user-balance endpoint.
 * ?action=get-balance&userId=... (GET) => returns current balance
 * Body { action: "top-up", userId, amount } (POST) => increments user balance
 */
export default async function userBalanceHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Verify the Authorization header:
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Missing Authorization header" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, error: "Invalid Authorization header" });
    }

    // Verify the Firebase ID token using adminAuth
    const decoded = await adminAuth.verifyIdToken(token);

    // 2) Parse userId / action
    // If using /api/user-balance?action=get-balance&userId=xxx for GET
    const { action, userId } = req.query as { action?: string; userId?: string };
    let finalUserId = userId;
    let finalAction = action;

    // If no userId in query for POST, read from body
    if (req.method === "POST") {
      const body = req.body || {};
      finalUserId = finalUserId || body.userId;
      finalAction = finalAction || body.action;
    }

    // Ensure the user in the token matches the userId param
    if (!finalUserId || decoded.uid !== finalUserId) {
      return res.status(403).json({ success: false, error: "User mismatch or missing userId" });
    }

    // 3) GET => retrieve user balance
    if (req.method === "GET" && finalAction === "get-balance") {
      const userRef = db.collection("users").doc(finalUserId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return res.status(404).json({ success: false, error: "User does not exist" });
      }
      const userData = userSnap.data() || {};
      const balance = userData.balance || 0;
      return res.status(200).json({ success: true, balance });
    }

    // 4) POST => handle top-up
    if (req.method === "POST" && finalAction === "top-up") {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid or missing top-up amount" });
      }

      // Increment user’s balance via your helper in firebase-admin.ts
      // This uses a transaction under the hood
      const newBalance = await topUpUserBalance(finalUserId, amount);

      return res.status(200).json({ success: true, newBalance });
    }

    // 5) If action/method not handled:
    return res.status(400).json({ success: false, error: "Invalid method or action" });
  } catch (error: any) {
    console.error("[user-balance] Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Server Error" });
  }
}
