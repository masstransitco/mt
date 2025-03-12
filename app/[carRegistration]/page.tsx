// src/app/[carRegistration]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/store";
import { fetchCarByRegistration, setScannedCar } from "@/store/carSlice";
import { selectCar } from "@/store/userSlice";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import { selectDepartureStation, advanceBookingStep } from "@/store/bookingSlice";
import { fetchDispatchLocations } from "@/store/dispatchSlice";
import { addVirtualStation } from "@/store/stationsSlice";
import { toast } from "react-hot-toast";

export default function CarRegistrationPage({
  params,
}: {
  params: { carRegistration: string };
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { carRegistration } = params;
  
  useEffect(() => {
    const processCarRegistration = async () => {
      try {
        // Extract and uppercase the registration
        const registration = carRegistration.toUpperCase();
        
        // This is the same logic from your QrScannerOverlay
        // 1) Fetch car from backend
        const carResult = await dispatch(fetchCarByRegistration(registration)).unwrap();
        
        if (!carResult) {
          toast.error(`Car ${registration} not found`);
          router.push("/");
          return;
        }
        
        // 2-8) Process the car exactly as in QrScannerOverlay
        await dispatch(setScannedCar(carResult));
        await dispatch(selectCar(carResult.id));
        await dispatch(fetchDispatchLocations());
        
        const virtualStationId = 1000000 + carResult.id;
        const virtualStation = createVirtualStationFromCar(carResult, virtualStationId);
        dispatch(addVirtualStation(virtualStation));
        await dispatch(selectDepartureStation(virtualStationId));
        await dispatch(advanceBookingStep(2));
        
        toast.success(`Car ${registration} selected and ready to drive`);
        
        // Redirect to home page (which will show step 2 UI)
        router.push("/");
      } catch (error) {
        console.error("Error processing car registration:", error);
        toast.error("Failed to process the car registration");
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    
    processCarRegistration();
  }, [carRegistration, dispatch, router]);
  
  // Simple loading UI
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-xl max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Mass Transit Company
        </h1>
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <p className="text-gray-300 text-center">
          Preparing your vehicle ({carRegistration})...
        </p>
      </div>
    </div>
  );
}
