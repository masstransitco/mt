"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, MapPin, CheckCircle, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import { doc, getFirestore, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

interface AddressInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Address {
  fullAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  block?: string; // optional
  floor?: string; // required
  flat?: string;  // required
  timestamp: number;
  verified: boolean;
}

export default function AddressInput({ isOpen, onClose, onSuccess }: AddressInputProps) {
  useBodyScrollLock(isOpen);
  
  // Address search state
  const [searchText, setSearchText] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<{
    text: string;
    location: google.maps.LatLngLiteral;
  } | null>(null);

  // Additional address details
  const [block, setBlock] = useState(""); // optional
  const [floor, setFloor] = useState(""); // required
  const [flat, setFlat] = useState("");  // required

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Google Maps services
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for scrolling
  const detailsRef = useRef<HTMLDivElement>(null);

  const db = getFirestore();

  // Initialize Google Maps services
  useEffect(() => {
    if (window.google && !autocompleteService.current) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      geocoder.current = new google.maps.Geocoder();
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Auto-close after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, onSuccess, onClose]);

  // Scroll to additional details when they appear
  useEffect(() => {
    if (selectedAddress && detailsRef.current) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [selectedAddress]);

  // Search for places
  const searchPlaces = useCallback((input: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!input.trim() || !autocompleteService.current) {
      setPredictions([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const request: google.maps.places.AutocompleteRequest = {
          input,
          // @ts-ignore
          types: ["establishment", "geocode"],
          componentRestrictions: { country: "HK" },
        };
        const response = await autocompleteService.current!.getPlacePredictions(request);
        setPredictions(response.predictions.slice(0, 5));
        setIsDropdownOpen(response.predictions.length > 0);
      } catch (err) {
        console.error("Error fetching predictions:", err);
        setPredictions([]);
        setIsDropdownOpen(false);
      }
    }, 300);
  }, []);

  // Handle address selection
  const handleSelect = useCallback(
    async (prediction: google.maps.places.AutocompletePrediction) => {
      if (!geocoder.current) return;
      try {
        const response = await geocoder.current.geocode({ placeId: prediction.place_id });
        const result = response.results[0];
        if (result?.geometry?.location) {
          const { lat, lng } = result.geometry.location;
          setSelectedAddress({
            text: prediction.structured_formatting.main_text,
            location: { lat: lat(), lng: lng() },
          });
          setSearchText(prediction.structured_formatting.main_text);
          setPredictions([]);
          setIsDropdownOpen(false);
          // Blur the input to hide keyboard on mobile
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        setError("Unable to locate address. Please try again.");
      }
    },
    []
  );

  // Save address to Firebase
  const handleSaveAddress = async () => {
    if (!selectedAddress || !auth.currentUser) return;

    if (!floor.trim() || !flat.trim()) {
      setError("Floor and Flat/Unit are required fields. Please fill them in.");
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const userId = auth.currentUser.uid;
      const timestamp = Date.now();

      const addressData: Address = {
        fullAddress: selectedAddress.text,
        location: selectedAddress.location,
        block: block.trim() || undefined,
        floor: floor.trim(),
        flat: flat.trim(),
        timestamp,
        verified: false,
      };

      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        await updateDoc(userDocRef, { "documents.address": addressData });
      } else {
        await setDoc(userDocRef, {
          userId,
          documents: { address: addressData },
        });
      }

      setSuccess(true);
    } catch (err) {
      console.error("Error saving address:", err);
      setError(`Failed to save address: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setSearchText("");
    setSelectedAddress(null);
    setBlock("");
    setFloor("");
    setFlat("");
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="p-0 gap-0 bg-black text-white flex flex-col overflow-visible w-full max-w-md md:max-w-2xl"
      >
        <DialogHeader className="px-6 py-4 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-10 flex-shrink-0">
          <DialogTitle className="text-white">
            {success ? "Address Saved" : "Add Residential Address"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 px-6 py-3 overflow-y-auto" style={{ touchAction: "none" }}>
          {/* Success message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-6"
            >
              <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Address Saved</h3>
              <p className="text-gray-400">Your address has been successfully saved</p>
            </motion.div>
          )}

          {/* Main address search & details form */}
          {!success && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {/* Search input (no label) */}
              <div className="space-y-1">
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => {
                        setSearchText(e.target.value);
                        searchPlaces(e.target.value);
                        if (selectedAddress) setSelectedAddress(null);
                      }}
                      onFocus={() => {
                        setFocusedField("search");
                        setIsDropdownOpen(predictions.length > 0);
                      }}
                      onBlur={() => {
                        setFocusedField(null);
                        setTimeout(() => setIsDropdownOpen(false), 150);
                      }}
                      placeholder="Search for your address"
                      className="w-full bg-gray-900 text-white border border-gray-800 rounded-md 
                                 focus:outline-none focus:border-gray-600 placeholder:text-gray-500 
                                 p-2 text-base transition-colors"
                    />
                    {searchText && (
                      <button
                        onClick={() => {
                          setSearchText("");
                          setPredictions([]);
                          setIsDropdownOpen(false);
                          setSelectedAddress(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 
                                   hover:bg-gray-800 p-1 rounded-full transition-colors"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Predictions dropdown */}
                  {isDropdownOpen && predictions.length > 0 && (
                    <div
                      className="absolute left-0 mt-1 bg-gray-900 border border-gray-800 
                                 rounded-md shadow-2xl overflow-y-auto"
                      style={{ maxHeight: "40vh", zIndex: 60, width: "100%" }}
                    >
                      <div className="flex justify-between items-center p-2 border-b border-gray-800">
                        <span className="text-xs text-gray-400">Select from suggestions</span>
                        <button
                          onClick={() => setIsDropdownOpen(false)}
                          className="text-gray-400 hover:text-white p-1 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          onClick={() => handleSelect(prediction)}
                          className="w-full px-4 py-3 text-left text-sm text-white 
                                     hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-0"
                          type="button"
                        >
                          <div className="font-medium">
                            {prediction.structured_formatting.main_text}
                          </div>
                          <div className="text-xs text-gray-400">
                            {prediction.structured_formatting.secondary_text}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {predictions.length > 0 && !isDropdownOpen && focusedField === "search" && (
                  <button
                    onClick={() => setIsDropdownOpen(true)}
                    className="flex items-center justify-center w-full text-xs text-gray-400 
                               bg-gray-800/50 rounded-md mt-1 py-1"
                  >
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show suggestions ({predictions.length})
                  </button>
                )}
              </div>

              {/* Additional address details */}
              {selectedAddress && (
                <motion.div
                  ref={detailsRef}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{selectedAddress.text}</span>
                  </div>

                  {/* Tower/Block (optional), Floor*, Flat* in one row */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* Tower/Block - remove (Optional) text */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-400">Tower / Block</label>
                      <input
                        type="text"
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        onFocus={() => setFocusedField("block")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Block A"
                        className="p-2 text-base bg-gray-900 text-white border border-gray-800 
                                   rounded-md focus:outline-none focus:border-gray-600 
                                   placeholder:text-gray-500 transition-colors"
                      />
                    </div>

                    {/* Floor - required */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-400">
                        Floor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        onFocus={() => setFocusedField("floor")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="10"
                        className="p-2 text-base bg-gray-900 text-white border border-gray-800 
                                   rounded-md focus:outline-none focus:border-gray-600 
                                   placeholder:text-gray-500 transition-colors"
                      />
                    </div>

                    {/* Flat - required */}
                    <div className="flex flex-col">
                      <label className="text-sm text-gray-400">
                        Flat / Unit <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={flat}
                        onChange={(e) => setFlat(e.target.value)}
                        onFocus={() => setFocusedField("flat")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="1234"
                        className="p-2 text-base bg-gray-900 text-white border border-gray-800 
                                   rounded-md focus:outline-none focus:border-gray-600 
                                   placeholder:text-gray-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Error message (for missing floor/flat, etc.) */}
                  {error && (
                    <div className="p-2 text-sm text-red-400 bg-red-400/10 rounded-md">
                      {error}
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <DialogFooter className="p-4 bg-black border-t border-gray-800 flex flex-row justify-between flex-shrink-0">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-white hover:bg-gray-800"
            >
              Cancel
            </Button>

            {selectedAddress ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="text-white border-gray-700 hover:bg-gray-800"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveAddress}
                  disabled={isLoading}
                  className="bg-white text-black hover:bg-gray-200 min-w-[100px]"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <span className="animate-spin h-4 w-4 border-2 border-gray-900 
                                   rounded-full border-t-transparent mr-2"
                      />
                      Saving...
                    </span>
                  ) : (
                    "Save Address"
                  )}
                </Button>
              </div>
            ) : (
              <Button
                disabled
                className="bg-gray-800 text-gray-400 cursor-not-allowed min-w-[100px]"
              >
                Save Address
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}