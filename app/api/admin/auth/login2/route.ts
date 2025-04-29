import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { initAdmin } from "@/lib/firebase-admin";

// Initialize Firebase Admin
initAdmin();

// Set session cookie expiration to 5 days
const SESSION_EXPIRATION_IN_SECONDS = 60 * 60 * 24 * 5;

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    
    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "No ID token provided" },
        { status: 400 }
      );
    }
    
    // Verify the ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // Check if user has admin role (you can customize this check)
    // This assumes you have custom claims set up for admin users
    const isAdmin = decodedToken.admin === true || decodedToken.role === "admin";
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Not authorized as admin" },
        { status: 403 }
      );
    }
    
    // Create a session cookie
    const sessionCookie = await getAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRATION_IN_SECONDS * 1000, // milliseconds
    });
    
    // Set the cookie
    cookies().set("__session", sessionCookie, {
      maxAge: SESSION_EXPIRATION_IN_SECONDS,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Authentication failed" },
      { status: 401 }
    );
  }
}