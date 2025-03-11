// File: app/admin/page.tsx
"use client";

import { useState } from "react";
import VerificationAdmin from "@/components/admin/VerificationAdmin";
import CarsAdmin from "@/components/admin/CarsAdmin";
import DispatchAdmin from "@/components/admin/DispatchAdmin"; // Import the DispatchAdmin component
import QrGenerator from "./qr-generator/page";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Mass Transit Dashboard</h1>
      
      {/* Navigation tabs - Added Dispatch tab */}
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
      
      {/* New Dispatch Admin tab */}
      {activeTab === "dispatch" && <DispatchAdmin />}
      
      {activeTab === "qr" && <QrGenerator />}
    </div>
  );
}
