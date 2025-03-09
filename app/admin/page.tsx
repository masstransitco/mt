// File: app/admin/page.tsx
"use client";

import VerificationAdmin from "@/components/admin/VerificationAdmin";
import CarsAdmin from "@/components/admin/CarsAdmin";

export default function AdminPage() {
  return (
    <div>
      <h1>Mass Transit Dashboard</h1>
      <VerificationAdmin />
      <CarsAdmin />
    </div>
  );
}
