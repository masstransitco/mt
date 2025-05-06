// File: app/admin/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast"
import { onAuthStateChanged } from "firebase/auth";
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase";
import VerificationAdmin from "@/components/admin/VerificationAdmin";
import CarsAdmin from "@/components/admin/CarsAdmin";
import DispatchAdmin from "@/components/admin/DispatchAdmin";
import QrGenerator from "./qr-generator/page";
import CarServicesAdmin from '@/components/admin/CarServicesAdmin';
import StaffsAdmin from '@/components/admin/StaffsAdmin';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/admin/signin");
        return;
      }
      
      try {
        // Get ID token result to check admin role
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.admin === true || tokenResult.claims.role === "admin";
        
        if (!isAdmin) {
          // Not an admin, redirect to unauthorized page
          router.push("/unauthorized");
          return;
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error checking admin status:", error);
        router.push("/admin/signin");
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
      try {
        // Sign out from Firebase
        await signOut(auth);
        
        // Clear session cookies from both endpoints
        await Promise.all([
          fetch("/api/admin/auth/logout", { method: "POST" })
        ]);
        
        // Redirect to sign in page
        router.push("/admin/signin");
        toast.success("Signed out successfully");
      } catch (error) {
        console.error("Sign out error:", error);
        toast.error("Failed to sign out");
      }
    }
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex space-x-10 mb-6">
        <h1 className="text-2xl font-bold mb-6">Mass Transit Dashboard</h1>
        <button
          className="bg-blue-400 text-white px-4 py-2 rounded-md"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
      
      {/* Navigation tabs */}
      <div className="flex space-x-2 mb-6 border-b border-gray-700">
        <button 
          className={`px-4 py-2 ${activeTab === "dashboard" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === "verification" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("verification")}
        >
          Verification
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === "cars" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("cars")}
        >
          Cars
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === "dispatch" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("dispatch")}
        >
          Dispatch
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === "qr" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("qr")}
        >
          QR Generator
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === "carservices" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("carservices")}
        >
          Car Services
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === "staffs" ? "border-b-2 border-blue-500 font-medium" : "text-gray-400"}`}
          onClick={() => setActiveTab("staffs")}
        >
          Manage Staffs
        </button>
      </div>
      
      {/* Content based on active tab */}
      {activeTab === "dashboard" && (
        <div>
          <h2 className="text-xl font-semibold mb-4">System Overview</h2>
          {/* Dashboard content here */}
        </div>
      )}
      
      {activeTab === "verification" && <VerificationAdmin />}
      
      {activeTab === "cars" && <CarsAdmin />}
      
      {activeTab === "dispatch" && <DispatchAdmin />}
      
      {activeTab === "qr" && <QrGenerator />}
      
      {activeTab === "carservices" && <CarServicesAdmin />}
      
      {activeTab === "staffs" && <StaffsAdmin />}
    </div>
  );
}
