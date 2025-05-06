import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import config from "@/config";

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  try {
    // First try using the SERVICE_ACCOUNT_KEY if available
    if (process.env.SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Admin initialized with SERVICE_ACCOUNT_KEY");
    } else {
      // Fall back to individual credentials
      const privateKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : undefined;
        
      if (!privateKey) {
        throw new Error("Missing FIREBASE_PRIVATE_KEY environment variable");
      }
      
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
      console.log("Firebase Admin initialized with individual credentials");
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
    throw error; // Re-throw to show the error in the API response
  }
}

const db = getFirestore();
const adminAuth = getAuth();

// Add dynamic routing to prevent build-time eval
export const dynamic = "force-dynamic";

// GET: Fetch all staff users
export async function GET(request: NextRequest) {
  // Skip processing during build time
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return NextResponse.json({
      success: false,
      error: "API not available during build",
    });
  }

  try {
    // Check if we're looking for non-admin users
    const searchParams = request.nextUrl.searchParams;
    const nonAdmin = searchParams.get('nonAdmin');
    
    if (nonAdmin === 'true') {
      return await GET_NON_ADMIN_USERS(request);
    }
    
    // Get all users from Firebase Auth
    const listUsersResult = await adminAuth.listUsers();
    const allAuthUsers = listUsersResult.users;
    
    // Filter to only include admin users based on customClaims
    const staffUsers = allAuthUsers
      .filter(user => 
        user.customClaims?.admin === true || user.customClaims?.role === "admin"
      )
      .map(user => ({
        id: user.uid,
        name: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        role: user.customClaims?.role || "admin"
      }));
    
    console.log(`Returning ${staffUsers.length} staff users`);
    return NextResponse.json({ success: true, staffs: staffUsers });
  } catch (error: any) {
    console.error("Error fetching staff users:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST: Create or promote a user to staff
export async function POST(request: NextRequest) {
  // Skip processing during build time
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return NextResponse.json({
      success: false,
      error: "API not available during build",
    });
  }

  try {
    const body = await request.json();
    const { existingUserId, name, email, phone, password } = body;

    // Case 1: Promote existing user to staff
    if (existingUserId) {
      // Set admin role in Firebase Auth - this is the source of truth
      await adminAuth.setCustomUserClaims(existingUserId, { 
        admin: true,
        role: "admin"
      });
      
      // Update display name if provided
      if (name) {
        await adminAuth.updateUser(existingUserId, {
          displayName: name
        });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "User promoted to staff successfully" 
      });
    }
    
    // Case 2: Create new user with staff role
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }
    
    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }
    
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    // Update user profile if name is provided
    if (name) {
      await adminAuth.updateUser(uid, {
        displayName: name
      });
    }
    
    // Set admin role
    await adminAuth.setCustomUserClaims(uid, { 
      admin: true,
      role: "admin"
    });
    
    return NextResponse.json({ 
      success: true, 
      message: "Staff created successfully",
      userId: uid
    });
  } catch (error: any) {
    console.error("Error creating/promoting staff:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update staff details
export async function PUT(request: NextRequest) {
  // Skip processing during build time
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return NextResponse.json({
      success: false,
      error: "API not available during build",
    });
  }

  try {
    const body = await request.json();
    const { userId, name, email, phone, password } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }
    
    // Update user in Firestore
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    
    await db.collection("users").doc(userId).update(updateData);
    
    // If password is provided, update it in Firebase Auth
    if (password) {
      await adminAuth.updateUser(userId, {
        password
      });
    }
    
    // If email is provided, update it in Firebase Auth
    if (email) {
      await adminAuth.updateUser(userId, {
        email
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Staff updated successfully" 
    });
  } catch (error: any) {
    console.error("Error updating staff:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET: Fetch non-admin users for promotion
async function GET_NON_ADMIN_USERS(request: NextRequest) {
  try {
    // 1. Get all Firebase Authentication users
    const listUsersResult = await adminAuth.listUsers();
    const allAuthUsers = listUsersResult.users;
    
    console.log(`Total users in Firebase Auth: ${allAuthUsers.length}`);
    
    // 2. Filter to only include non-admin users based on customClaims
    const nonAdminUsers = allAuthUsers
      .filter(user => 
        !(user.customClaims?.admin === true || user.customClaims?.role === "admin")
      )
      .map(user => ({
        id: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        phoneNumber: user.phoneNumber || ""
      }));
    
    console.log(`Returning ${nonAdminUsers.length} non-admin users`);
    return NextResponse.json({ success: true, users: nonAdminUsers });
  } catch (error: any) {
    console.error("Error fetching non-admin users:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Remove admin role from a user
export async function DELETE(request: NextRequest) {
  // Skip processing during build time
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return NextResponse.json({
      success: false,
      error: "API not available during build",
    });
  }

  try {
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }
    
    // Get the current user to check their claims
    const user = await adminAuth.getUser(userId);
    
    // Create new claims object without admin privileges
    const newClaims = { ...user.customClaims };
    delete newClaims.admin;
    delete newClaims.role;
    
    // Update the user's custom claims
    await adminAuth.setCustomUserClaims(userId, newClaims);
    
    return NextResponse.json({ 
      success: true, 
      message: "Admin role removed successfully" 
    });
  } catch (error: any) {
    console.error("Error removing admin role:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
