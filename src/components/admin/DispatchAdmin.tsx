"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store/store";
import { 
  selectAllCars, 
  setAvailableForDispatch,
  selectAvailableForDispatch
} from "@/store/carSlice";
import { 
  selectAllDispatchLocations,
  selectDispatchRadius,
  setDispatchRadius
} from "@/store/dispatchSlice";
import { toast } from "react-hot-toast";

export default function DispatchAdmin() {
  const dispatch = useAppDispatch();
  const cars = useAppSelector(selectAllCars);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  const dispatchLocations = useAppSelector(selectAllDispatchLocations);
  // Get radius directly from Redux
  const radiusMeters = useAppSelector(selectDispatchRadius);
  
  // State for car availability toggle
  const [carAvailability, setCarAvailability] = useState<{[key: number]: boolean}>({});
  
  // State for bulk actions
  const [selectAll, setSelectAll] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Initialize car availability state based on current available cars
    const initialAvailability: {[key: number]: boolean} = {};
    cars.forEach(car => {
      initialAvailability[car.id] = !!availableCars.find(ac => ac.id === car.id);
    });
    setCarAvailability(initialAvailability);
  }, [cars, availableCars]);
  
  // Update all car availability based on selectAll toggle
  useEffect(() => {
    if (cars.length > 0) {
      const newAvailability = {...carAvailability};
      cars.forEach(car => {
        newAvailability[car.id] = selectAll;
      });
      setCarAvailability(newAvailability);
    }
  }, [selectAll]);
  
  // Function to calculate distance between points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    if (typeof lat1 !== 'number' || typeof lng1 !== 'number' || 
        typeof lat2 !== 'number' || typeof lng2 !== 'number') {
      return Number.MAX_SAFE_INTEGER;
    }

    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  
  // Handle radius change - now updates Redux directly
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      dispatch(setDispatchRadius(value));
    }
  };
  
  // Handle car availability toggle
  const handleCarAvailabilityToggle = (carId: number) => {
    setCarAvailability({
      ...carAvailability,
      [carId]: !carAvailability[carId]
    });
  };
  
  // Apply settings and update available cars
  const applySettings = () => {
    setIsLoading(true);
    
    try {
      // Get cars that should be available based on toggles
      const manuallySelectedCars = cars.filter(car => carAvailability[car.id]);
      
      // Update Redux store with the manually selected cars
      dispatch(setAvailableForDispatch(manuallySelectedCars));
      
      toast.success("Dispatch settings updated successfully");
    } catch (error) {
      console.error("Error applying dispatch settings:", error);
      toast.error("Failed to update dispatch settings");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Auto filter cars by radius (simulates what dispatchManager would do)
  const autoFilterByRadius = () => {
    setIsLoading(true);
    
    try {
      const newAvailability = {...carAvailability};
      
      cars.forEach(car => {
        // Check if car is within radius of any dispatch location
        const isWithinRadius = dispatchLocations.some(dispatchLoc => {
          const distance = calculateDistance(car.lat, car.lng, dispatchLoc.lat, dispatchLoc.lng);
          return distance <= radiusMeters;
        });
        
        newAvailability[car.id] = isWithinRadius;
      });
      
      setCarAvailability(newAvailability);
      toast.success("Cars filtered by radius");
    } catch (error) {
      console.error("Error filtering cars by radius:", error);
      toast.error("Failed to filter cars");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dispatch Management</h1>
      
      {/* Settings Panel */}
      <div className="mb-6 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">Dispatch Settings</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Dispatch Radius (meters)
          </label>
          <input
            type="number"
            value={radiusMeters}
            onChange={handleRadiusChange}
            min="0"
            max="100000"
            step="1000"
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
          />
          <div className="mt-2">
            <input
              type="range"
              value={radiusMeters}
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
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={autoFilterByRadius}
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
              "Apply Settings"
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
          Total Cars: {cars.length}, Available for Dispatch: {Object.values(carAvailability).filter(v => v).length}
        </div>
        
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
              {cars.map(car => {
                // Calculate closest dispatch location
                let closestDistance = Number.MAX_SAFE_INTEGER;
                let closestDispatchId = null;
                
                if (dispatchLocations.length > 0) {
                  dispatchLocations.forEach(dispatchLoc => {
                    const distance = calculateDistance(
                      car.lat, car.lng, 
                      dispatchLoc.lat, dispatchLoc.lng
                    );
                    if (distance < closestDistance) {
                      closestDistance = distance;
                      closestDispatchId = dispatchLoc.id;
                    }
                  });
                }
                
                // Is within radius?
                const isWithinRadius = closestDistance <= radiusMeters;
                
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
                          {(closestDistance / 1000).toFixed(2)} km to Dispatch #{closestDispatchId}
                        </span>
                      ) : (
                        "No dispatch locations"
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
      </div>
    </div>
  );
}
