"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import {
  selectAllCars,
  setAvailableForDispatch,
  selectAvailableForDispatch,
  fetchCars,
} from "@/store/carSlice";
import {
  selectAllDispatchLocations,
  selectDispatchRadius,
  setDispatchRadius,
  fetchDispatchLocations,
  setManualSelectionMode,
  selectManualSelectionMode,
} from "@/store/dispatchSlice";
import { toast } from "react-hot-toast";

export default function DispatchAdmin() {
  const dispatch = useAppDispatch();
  const cars = useAppSelector(selectAllCars);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);
  const radiusMeters = useAppSelector(selectDispatchRadius);
  const isManualMode = useAppSelector(selectManualSelectionMode);

  // --- Local UI states ---
  const [carAvailability, setCarAvailability] = useState<{ [key: number]: boolean }>({});
  const [selectAll, setSelectAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // --- Feedback states ---
  const [showRadiusChange, setShowRadiusChange] = useState(false);
  const [radiusChangeMessage, setRadiusChangeMessage] = useState("");

  // --- Local radius tracking ---
  const [localRadius, setLocalRadius] = useState(radiusMeters);

  // Keep local radius in sync with Redux radius if changed externally
  useEffect(() => {
    if (radiusMeters !== localRadius) {
      console.log(
        `DispatchAdmin: Syncing local radius (${localRadius}) with Redux radius (${radiusMeters})`
      );
      setLocalRadius(radiusMeters);
    }
  }, [radiusMeters, localRadius]);

  // --- Load initial data (cars + dispatch locations) on mount ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      console.log("DispatchAdmin: Loading initial data...");

      try {
        // Fetch cars & dispatch locations if not already loaded
        if (cars.length === 0) {
          console.log("DispatchAdmin: Fetching cars...");
          await dispatch(fetchCars()).unwrap();
        }
        if (dispatchLocations.length === 0) {
          console.log("DispatchAdmin: Fetching dispatch locations...");
          await dispatch(fetchDispatchLocations()).unwrap();
        }
      } catch (error) {
        console.error("DispatchAdmin: Error loading initial data:", error);
        toast.error("Error loading car and dispatch data");
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    loadData();

    // Enable manual selection mode when admin panel is loaded
    dispatch(setManualSelectionMode(true));
    console.log("DispatchAdmin: Enabled manual selection mode");

    // Debug logs
    console.log(`DispatchAdmin: Current radius is ${radiusMeters} meters`);
    console.log(
      `DispatchAdmin: ${cars.length} cars loaded, ${availableCars.length} available for dispatch`
    );
    console.log(`DispatchAdmin: ${dispatchLocations.length} dispatch locations loaded`);

    // Cleanup - disable manual mode when component unmounts
    return () => {
      dispatch(setManualSelectionMode(false));
      console.log("DispatchAdmin: Disabled manual selection mode on unmount");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Remove the effect that “mirrors” Redux back into carAvailability ---
  // (No more re-initializing from store, so user toggles won't get reset.)

  // Update all car availability based on selectAll toggle
  useEffect(() => {
    if (cars.length > 0) {
      const newAvailability = { ...carAvailability };
      cars.forEach((car) => {
        newAvailability[car.id] = selectAll;
      });
      setCarAvailability(newAvailability);
      console.log(`DispatchAdmin: Toggle select all to ${selectAll ? "selected" : "unselected"}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAll]);

  // --- Distance helper ---
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    if (
      typeof lat1 !== "number" ||
      typeof lng1 !== "number" ||
      typeof lat2 !== "number" ||
      typeof lng2 !== "number"
    ) {
      return Number.MAX_SAFE_INTEGER;
    }

    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // --- Radius input change ---
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      console.log(
        `DispatchAdmin: Radius change event, new value: ${value}, current Redux value: ${radiusMeters}`
      );

      // Update local state
      setLocalRadius(value);

      // Ensure we're in manual mode
      if (!isManualMode) {
        dispatch(setManualSelectionMode(true));
      }

      // Update Redux
      dispatch(setDispatchRadius(value));
      console.log(`DispatchAdmin: Dispatched setDispatchRadius(${value})`);

      // Show quick feedback
      setRadiusChangeMessage(`Radius updated to ${value} meters`);
      setShowRadiusChange(true);
      setTimeout(() => {
        setShowRadiusChange(false);
      }, 3000);
    }
  };

  // --- Toggle individual car checkboxes ---
  const handleCarAvailabilityToggle = (carId: number) => {
    // Make sure we're in manual mode
    if (!isManualMode) {
      dispatch(setManualSelectionMode(true));
    }
    setCarAvailability({
      ...carAvailability,
      [carId]: !carAvailability[carId],
    });
    console.log(
      `DispatchAdmin: Toggled car ${carId} to ${!carAvailability[carId] ? "available" : "unavailable"}`
    );
  };

  // --- Apply all manual settings to Redux ---
  const applySettings = () => {
    setIsLoading(true);
    console.log("DispatchAdmin: Applying settings...");

    try {
      // Ensure manual mode
      if (!isManualMode) {
        dispatch(setManualSelectionMode(true));
      }

      // Gather all manually selected cars
      const manuallySelectedCars = cars.filter((car) => carAvailability[car.id]);
      console.log(
        `DispatchAdmin: Setting ${manuallySelectedCars.length} cars as available for dispatch`
      );

      // Update Redux store
      dispatch(setAvailableForDispatch(manuallySelectedCars));
      dispatch(setDispatchRadius(localRadius));

      toast.success(`${manuallySelectedCars.length} cars set as available for dispatch`);
    } catch (error) {
      console.error("DispatchAdmin: Error applying dispatch settings:", error);
      toast.error("Failed to update dispatch settings");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Auto filter cars by radius, toggling them in local state + Redux immediately ---
  const autoFilterByRadius = (directRadius?: number) => {
    const radiusToUse = directRadius ?? localRadius;

    setIsLoading(true);
    console.log(`DispatchAdmin: Auto-filtering cars by ${radiusToUse} meter radius...`);

    try {
      // Ensure manual mode
      if (!isManualMode) {
        dispatch(setManualSelectionMode(true));
      }

      const newAvailability = { ...carAvailability };
      let count = 0;

      cars.forEach((car) => {
        const isWithinRadius = dispatchLocations.some((dispatchLoc) => {
          const distance = calculateDistance(car.lat, car.lng, dispatchLoc.lat, dispatchLoc.lng);
          return distance <= radiusToUse;
        });
        newAvailability[car.id] = isWithinRadius;
        if (isWithinRadius) count++;
      });

      // Update local toggles
      setCarAvailability(newAvailability);
      console.log(`DispatchAdmin: Found ${count} cars within ${radiusToUse} meter radius`);

      // Immediately update Redux store
      const filteredCars = cars.filter((car) => newAvailability[car.id]);
      dispatch(setAvailableForDispatch(filteredCars));

      // Sync radius if needed
      if (directRadius && directRadius !== radiusMeters) {
        dispatch(setDispatchRadius(directRadius));
      }

      toast.success(`${count} cars found and set for dispatch within ${radiusToUse} meter radius`);
    } catch (error) {
      console.error("DispatchAdmin: Error filtering cars by radius:", error);
      toast.error("Failed to filter cars");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Distance formatting helper ---
  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // --- Debug info about empty lists ---
  const debugInfo = () => {
    const messages = [];
    if (cars.length === 0) messages.push("No cars loaded");
    if (dispatchLocations.length === 0) messages.push("No dispatch locations loaded");
    return messages.join(", ");
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dispatch Management</h1>

      {/* Manual Mode Indicator */}
      <div className="mb-2">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            isManualMode ? "bg-green-800/30 text-green-400" : "bg-yellow-800/30 text-yellow-400"
          }`}
        >
          <span
            className={`mr-2 h-2 w-2 rounded-full ${
              isManualMode ? "bg-green-500" : "bg-yellow-500"
            }`}
          ></span>
          {isManualMode ? "Manual Selection Mode Active" : "Automatic Mode Active"}
        </span>
      </div>

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

      {/* Settings Panel */}
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
            Changes to radius are saved when you click "Apply Manual Selection"
          </p>

          {/* Debug info */}
          <p className="text-xs text-gray-500 mt-1">
            Redux radius: {radiusMeters}m | Local radius: {localRadius}m | Manual mode:{" "}
            {isManualMode ? "Yes" : "No"}
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

          <button
            onClick={applySettings}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              "Apply Manual Selection"
            )}
          </button>

          <button
            onClick={() => {
              dispatch(fetchCars());
              dispatch(fetchDispatchLocations());
              toast.success("Refreshing car and dispatch data...");
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center"
            disabled={isLoading}
          >
            Refresh Data
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
          Total Cars: {cars.length}, Available for Dispatch:{" "}
          {Object.values(carAvailability).filter(Boolean).length}
        </div>

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
              <p className="text-gray-400 mb-2">No cars found. This could be because:</p>
              <ul className="text-gray-500 list-disc list-inside text-sm">
                <li>No cars are available in the system</li>
                <li>The cars API endpoint is not responding</li>
                <li>There was an error loading car data</li>
              </ul>
              <div className="mt-4 text-xs text-gray-600">{debugInfo()}</div>
              <button
                onClick={() => {
                  dispatch(fetchCars());
                  toast.success("Attempting to reload car data...");
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reload Cars
              </button>
            </div>
          </div>
        )}

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
                  <th className="p-2 border border-gray-700 text-left">Available for Dispatch</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => {
                  // Calculate closest dispatch location
                  let closestDistance = Number.MAX_SAFE_INTEGER;
                  let closestDispatchId = null;

                  if (dispatchLocations.length > 0) {
                    dispatchLocations.forEach((dispatchLoc) => {
                      const distance = calculateDistance(
                        car.lat,
                        car.lng,
                        dispatchLoc.lat,
                        dispatchLoc.lng
                      );
                      if (distance < closestDistance) {
                        closestDistance = distance;
                        closestDispatchId = dispatchLoc.id;
                      }
                    });
                  }

                  // Check if within localRadius
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
                            {formatDistance(closestDistance)} to Dispatch #{closestDispatchId}
                          </span>
                        ) : (
                          <span className="text-gray-500">No dispatch locations</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-700">
                        <label className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={!!carAvailability[car.id]}
                            onChange={() => handleCarAvailabilityToggle(car.id)}
                            className="h-5 w-5"
                          />
                        </label>
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
