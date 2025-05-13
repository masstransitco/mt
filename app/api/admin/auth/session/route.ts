import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

// Session duration: 2 weeks
const SESSION_EXPIRATION_TIME = 60 * 60 * 24 * 14 * 1000;

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    
    if (!idToken) {
      return NextResponse.json({ message: "Missing ID token" }, { status: 400 });
    }
    
    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    // Check if user has admin role
    // You can use custom claims for this
    const isAdmin = decodedToken.admin === true || decodedToken.role === "admin";
    
    if (!isAdmin) {
      return NextResponse.json({ message: "Unauthorized: Not an admin" }, { status: 403 });
    }
    
    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRATION_TIME,
    });
    
    // Set the cookie
    cookies().set({
      name: "__session",
      value: sessionCookie,
      maxAge: SESSION_EXPIRATION_TIME / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { message: "Authentication failed" },
      { status: 401 }
    );
  }
}