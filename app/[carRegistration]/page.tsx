"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/store";
import { setQrStationData } from "@/store/bookingSlice";
import { fetchCarByRegistration, setScannedCar } from "@/store/carSlice";
import { selectCar } from "@/store/userSlice";
import { createVirtualStationFromCar } from "@/lib/stationUtils";
import {
  advanceBookingStep,
  resetBookingFlow,
  clearRoute,
  clearArrivalStation,
  clearDepartureStation,
  selectDepartureStation
} from "@/store/bookingSlice";
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
        // Force a clean ephemeral booking state (no partial or leftover data)
        dispatch(resetBookingFlow());
        dispatch(clearRoute());
        dispatch(clearArrivalStation());
        dispatch(clearDepartureStation());

        // Extract and uppercase the registration
        const registration = carRegistration.toUpperCase();

        // 1) Fetch the car
        const carResult = await dispatch(
          fetchCarByRegistration(registration)
        ).unwrap();

        if (!carResult) {
          toast.error(`Car ${registration} not found`);
          router.push("/");
          return;
        }

        // 2) Mark this car as scanned, fetch dispatch data
        await dispatch(setScannedCar(carResult));
        await dispatch(selectCar(carResult.id));
        await dispatch(fetchDispatchLocations());

        // 3) Create a virtual station for the car
        const virtualStationId = 1000000 + carResult.id;
        const virtualStation = createVirtualStationFromCar(
          carResult,
          virtualStationId
        );

        // IMPORTANT: ensure the station is actually in Redux
        // before selecting it as departure
        dispatch(addVirtualStation(virtualStation));

        // Wait a short moment so Redux finishes adding the station
        // (prevents GMap from missing it in the first render)
        await new Promise((resolve) => setTimeout(resolve, 50));

        // 4) Set that station as departure & move to step=2
        await dispatch(selectDepartureStation(virtualStationId));
        await dispatch(advanceBookingStep(2));

        // Also mark it as a "QR" station in Redux, so GMap sees it the same as scanning
        dispatch(
          setQrStationData({
            isQrScanStation: true,
            qrVirtualStationId: virtualStationId,
          })
        );

        toast.success(`Car ${registration} selected and ready to drive`);

        // Finally, go home (where GMap will see us at step=2 with this station)
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
