"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import {
  selectAllCars,
  setAvailableForDispatch,
  fetchCars,
  selectAvailableForDispatch,
} from "@/store/carSlice";
import {
  selectAllDispatchLocations,
  selectDispatchRadius,
  setDispatchRadius,
  fetchDispatchLocations,
} from "@/store/dispatchSlice";
import { toast } from "react-hot-toast";

/** 
 * Writes the selected car IDs to Firestore via /api/availability.
 */
async function updateGlobalAvailability(carIds: number[]) {
  try {
    const resp = await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        availableCarIds: carIds,
        adminPassword: "20230301", // For production, use env var
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || "Failed to update availability");
    }
    console.log("[DispatchAdmin] Global availability updated successfully!");
  } catch (error) {
    console.error("[DispatchAdmin] Error updating global availability:", error);
    toast.error("Could not save global availability");
  }
}

export default function DispatchAdmin() {
  const dispatch = useAppDispatch();

  // Grab data from Redux
  const cars = useAppSelector(selectAllCars);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);
  const radiusMeters = useAppSelector(selectDispatchRadius);

  // Local component states
  const [carAvailability, setCarAvailability] = useState<{ [key: number]: boolean }>({});
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [showRadiusChange, setShowRadiusChange] = useState(false);
  const [radiusChangeMessage, setRadiusChangeMessage] = useState("");
  const [localRadius, setLocalRadius] = useState(radiusMeters);

  // Keep local radius in sync with Redux radius
  useEffect(() => {
    if (radiusMeters !== localRadius) {
      console.log(`DispatchAdmin: Sync radius local(${localRadius}) → store(${radiusMeters})`);
      setLocalRadius(radiusMeters);
    }
  }, [radiusMeters, localRadius]);

  /**
   * 1) On mount, load cars & dispatch locations.
   *    Then fetch the already saved availability from /api/availability
   *    so we can restore the checkboxes from a previous session.
   */
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load car + dispatch data if not already loaded
        if (cars.length === 0) {
          await dispatch(fetchCars()).unwrap();
        }
        if (dispatchLocations.length === 0) {
          await dispatch(fetchDispatchLocations()).unwrap();
        }

        // After we have the cars, fetch the saved "availableCarIds"
        const resp = await fetch("/api/availability");
        if (!resp.ok) {
          throw new Error(`Failed to load saved availability: ${resp.statusText}`);
        }
        const data = await resp.json();
        if (data?.success) {
          const savedCarIds: number[] = data.availableCarIds || [];
          console.log("[DispatchAdmin] Restoring savedCarIds from Firestore:", savedCarIds);

          // Build a new carAvailability object from the saved IDs
          const newAvailability: { [key: number]: boolean } = {};
          cars.forEach((car) => {
            newAvailability[car.id] = savedCarIds.includes(car.id);
          });
          setCarAvailability(newAvailability);

          // Also reflect in Redux
          const matchedCars = cars.filter((car) => savedCarIds.includes(car.id));
          dispatch(setAvailableForDispatch(matchedCars));
        } else {
          console.warn("[DispatchAdmin] No success field or no data from /api/availability");
        }
      } catch (error) {
        console.error("[DispatchAdmin] Error loading data:", error);
        toast.error("Error loading car & dispatch data");
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
    loadData();
  }, [dispatch, cars.length, dispatchLocations.length]);

  /**
   * 2) If "select all" is toggled, update local + Redux + Firestore
   */
  useEffect(() => {
    if (cars.length > 0) {
      const newAvailability: { [key: number]: boolean } = {};
      cars.forEach((car) => {
        newAvailability[car.id] = selectAll;
      });
      setCarAvailability(newAvailability);

      const selectedCars = cars.filter((car) => newAvailability[car.id]);
      dispatch(setAvailableForDispatch(selectedCars));
      updateGlobalAvailability(selectedCars.map((c) => c.id));

      console.log(`[DispatchAdmin] selectAll → ${selectAll ? "all" : "none"} selected`);
    }
  }, [selectAll, cars, dispatch]);

  /**
   * 3) Toggle an individual car’s checkbox
   */
  const handleCarAvailabilityToggle = (carId: number) => {
    const newAvailability = { ...carAvailability, [carId]: !carAvailability[carId] };
    setCarAvailability(newAvailability);

    const selectedCars = cars.filter((car) => newAvailability[car.id]);
    dispatch(setAvailableForDispatch(selectedCars));
    updateGlobalAvailability(selectedCars.map((c) => c.id));

    console.log(`[DispatchAdmin] Toggled car ${carId}: now ${newAvailability[carId]}`);
  };

  /**
   * 4) Helper for distance calculation
   */
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    if ([lat1, lng1, lat2, lng2].some((val) => typeof val !== "number")) {
      return Number.MAX_SAFE_INTEGER;
    }
    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  /**
   * 5) Handle radius input changes
   */
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      console.log(`[DispatchAdmin] radius changed → ${value}`);
      setLocalRadius(value);
      dispatch(setDispatchRadius(value));
      setRadiusChangeMessage(`Radius updated to ${value} meters`);
      setShowRadiusChange(true);
      setTimeout(() => setShowRadiusChange(false), 3000);
    }
  };

  /**
   * 6) “Auto-Filter by Radius” button
   */
  const autoFilterByRadius = (directRadius?: number) => {
    const radiusToUse = directRadius ?? localRadius;
    setIsLoading(true);
    try {
      const newAvailability: { [key: number]: boolean } = {};
      let count = 0;
      cars.forEach((car) => {
        const withinRadius = dispatchLocations.some((loc) => {
          const distance = calculateDistance(car.lat, car.lng, loc.lat, loc.lng);
          return distance <= radiusToUse;
        });
        newAvailability[car.id] = withinRadius;
        if (withinRadius) count++;
      });
      setCarAvailability(newAvailability);

      const filteredCars = cars.filter((car) => newAvailability[car.id]);
      dispatch(setAvailableForDispatch(filteredCars));
      updateGlobalAvailability(filteredCars.map((c) => c.id));

      if (directRadius && directRadius !== radiusMeters) {
        dispatch(setDispatchRadius(directRadius));
      }

      toast.success(`${count} cars set for dispatch (within ${radiusToUse}m)`);
      console.log(`[DispatchAdmin] Found ${count} cars within ${radiusToUse}m`);
    } catch (error) {
      console.error("[DispatchAdmin] Error filtering by radius:", error);
      toast.error("Failed to filter cars by radius");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * For display
   */
  const formatDistance = (meters: number) => {
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;
  };

  const debugInfo = () => {
    const messages: string[] = [];
    if (cars.length === 0) messages.push("No cars loaded");
    if (dispatchLocations.length === 0) messages.push("No dispatch locations loaded");
    return messages.join(", ");
  };

  // --- Render ---
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dispatch Management (Single-Mode)</h1>

      {/* Current Radius Display */}
      <div className="mb-4 flex items-center">
        <div className="bg-gray-700 rounded-lg py-2 px-4 inline-flex items-center">
          <span className="text-gray-300 mr-2">Current Dispatch Radius:</span>
          <span className="font-bold text-white">{formatDistance(radiusMeters)}</span>
        </div>
        {showRadiusChange && (
          <div className="ml-4 bg-blue-500/20 text-blue-300 py-1 px-3 rounded-full text-sm animate-pulse">
            {radiusChangeMessage}
          </div>
        )}
      </div>

      {/* Settings Panel (Radius) */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Dispatch Settings</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Adjust Dispatch Radius</label>
          <input
            type="number"
            value={localRadius}
            onChange={handleRadiusChange}
            min="0"
            max="100000"
            step="1000"
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
          />
          <div className="mt-2">
            <input
              type="range"
              value={localRadius}
              onChange={handleRadiusChange}
              min="0"
              max="100000"
              step="1000"
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0 m</span>
              <span>25000 m</span>
              <span>50000 m</span>
              <span>75000 m</span>
              <span>100000 m</span>
            </div>
          </div>
          <p className="text-xs text-blue-300 mt-1 italic">
            This radius is just a reference for the admin to auto-filter
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => autoFilterByRadius()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                Processing...
              </>
            ) : (
              "Auto-Filter by Radius"
            )}
          </button>
        </div>
      </div>

      {/* Cars Table */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cars Available for Dispatch</h2>
          <div className="flex items-center">
            <label className="mr-2 text-gray-400">Select All</label>
            <input
              type="checkbox"
              checked={selectAll}
              onChange={() => setSelectAll(!selectAll)}
              className="h-5 w-5"
            />
          </div>
        </div>
        <div className="mb-2 text-sm text-gray-400">
          Total Cars: {cars.length}, Currently Checked:{" "}
          {Object.values(carAvailability).filter(Boolean).length}
        </div>

        {/* Loading / No Cars States */}
        {(isInitialLoad || isLoading) && (
          <div className="bg-gray-800 rounded-lg p-12 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="animate-spin h-8 w-8 border-3 border-blue-500 rounded-full border-t-transparent mb-4"></div>
              <p className="text-gray-400">Loading car data...</p>
            </div>
          </div>
        )}
        {!isInitialLoad && !isLoading && cars.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-12 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-2">No cars found. Possible reasons:</p>
              <ul className="text-gray-500 list-disc list-inside text-sm">
                <li>No cars in system</li>
                <li>API error</li>
                <li>Loading error</li>
              </ul>
              <div className="mt-4 text-xs text-gray-600">{debugInfo()}</div>
              <button
                onClick={() => {
                  dispatch(fetchCars());
                  toast.success("Reloading car data...");
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reload Cars
              </button>
            </div>
          </div>
        )}

        {/* The Cars Table */}
        {!isInitialLoad && !isLoading && cars.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="p-2 border border-gray-700 text-left">ID</th>
                  <th className="p-2 border border-gray-700 text-left">Name</th>
                  <th className="p-2 border border-gray-700 text-left">Model</th>
                  <th className="p-2 border border-gray-700 text-left">Location</th>
                  <th className="p-2 border border-gray-700 text-left">Distance to Dispatch</th>
                  <th className="p-2 border border-gray-700 text-left">Available?</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => {
                  // For reference: compute distance to the closest dispatch location
                  let closestDistance = Number.MAX_SAFE_INTEGER;
                  let closestDispatchId: number | null = null;
                  if (dispatchLocations.length > 0) {
                    dispatchLocations.forEach((loc) => {
                      const distance = calculateDistance(car.lat, car.lng, loc.lat, loc.lng);
                      if (distance < closestDistance) {
                        closestDistance = distance;
                        closestDispatchId = loc.id;
                      }
                    });
                  }
                  const isWithinRadius = closestDistance <= localRadius;

                  return (
                    <tr key={car.id} className="hover:bg-gray-700">
                      <td className="p-2 border border-gray-700">{car.id}</td>
                      <td className="p-2 border border-gray-700">{car.name}</td>
                      <td className="p-2 border border-gray-700">{car.model}</td>
                      <td className="p-2 border border-gray-700">
                        {car.lat.toFixed(6)}, {car.lng.toFixed(6)}
                      </td>
                      <td className="p-2 border border-gray-700">
                        {closestDispatchId !== null ? (
                          <span className={isWithinRadius ? "text-green-400" : "text-red-400"}>
                            {formatDistance(closestDistance)} (Dispatch #{closestDispatchId})
                          </span>
                        ) : (
                          <span className="text-gray-500">No dispatch locations</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-700">
                        <input
                          type="checkbox"
                          checked={!!carAvailability[car.id]}
                          onChange={() => handleCarAvailabilityToggle(car.id)}
                          className="h-5 w-5"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
