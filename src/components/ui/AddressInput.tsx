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
  block?: string;
  floor?: string;
  flat?: string;
  timestamp: number;
  verified: boolean;
}

export default function AddressInput({ isOpen, onClose, onSuccess }: AddressInputProps) {
  // Address search state
  const [searchText, setSearchText] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<{
    text: string;
    location: google.maps.LatLngLiteral;
  } | null>(null);

  // Additional address details
  const [block, setBlock] = useState("");
  const [floor, setFloor] = useState("");
  const [flat, setFlat] = useState("");

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
      // Use a small timeout to allow animation to start
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      } catch (error) {
        console.error("Error fetching predictions:", error);
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
        const response = await geocoder.current.geocode({
          placeId: prediction.place_id,
        });
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
      } catch (error) {
        console.error("Geocoding error:", error);
        setError("Unable to locate address. Please try again.");
      }
    },
    []
  );

  // Save address to Firebase
  const handleSaveAddress = async () => {
    if (!selectedAddress || !auth.currentUser) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const userId = auth.currentUser.uid;
      const timestamp = new Date().getTime();
      
      // Create address object
      const addressData: Address = {
        fullAddress: selectedAddress.text,
        location: selectedAddress.location,
        block: block.trim() || undefined,
        floor: floor.trim() || undefined,
        flat: flat.trim() || undefined,
        timestamp,
        verified: false,
      };
      
      // Check if user document exists
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        // Update existing document
        await updateDoc(userDocRef, {
          "documents.address": addressData,
        });
      } else {
        // Create new document
        await setDoc(userDocRef, {
          userId,
          documents: {
            address: addressData,
          },
        });
      }
      
      // Show success state
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
   <Dialog
  open={isOpen}
  onOpenChange={(open) => {
    if (!open) onClose();
  }}
>
  <DialogContent
  className="p-0 gap-0 w-[90vw] max-w-md md:max-w-2xl bg-black text-white flex flex-col"
  style={{
    top: '2rem', // Position near the top instead of centered
    transform: 'translateX(-50%)', // Keep horizontal centering
    marginTop: 0,
    // Override the default transform that centers vertically
    height: 'auto',
    maxHeight: 'calc(100vh - 4rem)', // Allow some space at top and bottom
    overflow: 'visible' // Allow predictions dropdown to be visible outside the dialog
  }}
  onClick={(e) => e.stopPropagation()}
>
  <DialogHeader className="px-6 py-4 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-10 flex-shrink-0">
    <DialogTitle className="text-white">
      {success ? "Address Saved" : "Add Residential Address"}
    </DialogTitle>
  </DialogHeader>

  <div 
    className="flex-1 px-6 py-4"
    style={{
      overflowY: 'auto',
      touchAction: 'none' // Disable touch actions on the scrollable area
    }}
  >

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {/* Success message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Address Saved</h3>
              <p className="text-gray-400">Your address has been successfully saved</p>
            </motion.div>
          )}

          {/* Address search and form */}
          {!success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Address search - Fixed at the top */}
              <div className="space-y-2 sticky top-0 bg-black pt-1 z-30">
                <label className="block text-sm text-gray-400">
                  Street Address
                </label>
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
                        // Small delay to allow for selection
                        setTimeout(() => setIsDropdownOpen(false), 150);
                      }}
                      placeholder="Search for your address"
                      className="w-full bg-gray-900 text-white border border-gray-800 rounded-md focus:outline-none focus:border-gray-600 placeholder:text-gray-500 p-2 text-base transition-colors"
                    />
                    {searchText && (
                      <button
                        onClick={() => {
                          setSearchText("");
                          setPredictions([]);
                          setIsDropdownOpen(false);
                          setSelectedAddress(null);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:bg-gray-800 p-1 rounded-full transition-colors"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Predictions dropdown - Above the field on mobile */}
{isDropdownOpen && predictions.length > 0 && (
  <div 
    className="fixed bottom-auto bg-gray-900 border border-gray-800 rounded-md shadow-2xl overflow-y-auto"
    style={{ 
      maxHeight: '40vh', 
      zIndex: 60, // Higher than DialogContent's z-50
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 3rem)', // Match the content width considering padding
      maxWidth: '2xl'
    }}
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
        className="w-full px-4 py-3 text-left text-sm text-white hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-0"
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
                    className="flex items-center justify-center w-full text-xs text-gray-400 bg-gray-800/50 rounded-md mt-1 py-1"
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
                  className="space-y-6 pt-1"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{selectedAddress.text}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">
                        Block / Tower
                      </label>
                      <input
                        type="text"
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        onFocus={() => setFocusedField("block")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. Block A"
                        className="w-full bg-gray-900 text-white border border-gray-800 rounded-md focus:outline-none focus:border-gray-600 placeholder:text-gray-500 p-2 text-base transition-colors"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">
                        Floor
                      </label>
                      <input
                        type="text"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        onFocus={() => setFocusedField("floor")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. 10"
                        className="w-full bg-gray-900 text-white border border-gray-800 rounded-md focus:outline-none focus:border-gray-600 placeholder:text-gray-500 p-2 text-base transition-colors"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">
                        Flat / Unit
                      </label>
                      <input
                        type="text"
                        value={flat}
                        onChange={(e) => setFlat(e.target.value)}
                        onFocus={() => setFocusedField("flat")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="e.g. 1234"
                        className="w-full bg-gray-900 text-white border border-gray-800 rounded-md focus:outline-none focus:border-gray-600 placeholder:text-gray-500 p-2 text-base transition-colors"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-400/10 rounded-md mt-4">
                  {error}
                </div>
              )}
            </motion.div>
          )}
        </div>

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
                      <span className="animate-spin h-4 w-4 border-2 border-gray-900 rounded-full border-t-transparent mr-2"></span>
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
