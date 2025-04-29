import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "react-hot-toast";

export async function logoutAdmin(router: any) {
  try {
    console.log("Starting logout process...");
    
    // Sign out from Firebase first (await it)
    await signOut(auth);
    console.log("Firebase signOut completed");
    
    // Clear session cookies in the background
    fetch("/api/admin/auth/logout", { method: "POST" })
      .then(() => console.log("Session cookies cleared"))
      .catch((apiError) => console.error("API error during logout:", apiError));
    
    // Show success message
    toast.success("Signed out successfully");
    
    // Use window.location for a hard redirect
    console.log("Redirecting to signin page...");
    window.location.href = "/admin/signin";
    
    return true;
  } catch (error) {
    console.error("Sign out error:", error);
    toast.error("Failed to sign out. Please try again.");
    
    // Don't redirect on failure - let the user stay on the current page
    // so they can try again or take other actions
    return false;
  }
}
