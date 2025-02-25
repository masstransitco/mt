"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Plus, CreditCard, MapPin, Car, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import { doc, getFirestore, getDoc } from "firebase/firestore";
import IDCamera from "./IDCamera";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DocumentStatus {
  url?: string;
  uploadedAt?: number;
  verified?: boolean;
}

interface UserDocuments {
  "id-document"?: DocumentStatus;
  "driving-license"?: DocumentStatus;
  address?: DocumentStatus;
}

export default function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showCamera, setShowCamera] = useState<"identity" | "license" | null>(null);
  const [documents, setDocuments] = useState<UserDocuments>({});
  const [loading, setLoading] = useState(true);
  
  const db = getFirestore();

  // Ensure client-side only rendering and fetch user documents
  React.useEffect(() => {
    setMounted(true);
    
    if (isOpen && auth.currentUser) {
      fetchUserDocuments();
    }
  }, [isOpen]);

  // Fetch user's document status from Firestore
  const fetchUserDocuments = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists() && userDoc.data().documents) {
        setDocuments(userDoc.data().documents as UserDocuments);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Open camera for ID document capture
  const handleAddIdentity = () => {
    setShowCamera("identity");
  };

  // Open camera for driving license capture
  const handleAddDrivingLicense = () => {
    setShowCamera("license");
  };

  // Handle address (to be implemented later)
  const handleAddAddress = () => {
    console.log("Add address");
    // Will implement later - could be a form instead of camera
  };

  // Handle successful document upload
  const handleDocumentUploaded = () => {
    fetchUserDocuments();
  };

  if (!mounted) {
    return null;
  }

  // Render document status
  const renderDocumentStatus = (
    type: "id-document" | "driving-license",
    document?: DocumentStatus
  ) => {
    if (!document || !document.url) {
      return null;
    }
    
    return (
      <div className="mt-2 flex items-center">
        {document.verified ? (
          <div className="flex items-center text-green-500">
            <Check className="w-4 h-4 mr-1" />
            <span className="text-xs">Verified</span>
          </div>
        ) : (
          <div className="flex items-center text-amber-500">
            <AlertCircle className="w-4 h-4 mr-1" />
            <span className="text-xs">Pending verification</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog
        open={isOpen && !showCamera}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className={cn(
            "p-0 gap-0",
            "w-[90vw] max-w-md md:max-w-2xl",
            "overflow-hidden bg-black text-white"
          )}
        >
          <DialogHeader className="px-6 py-4 border-b border-gray-800">
            <DialogTitle className="text-white text-lg font-medium">License & ID</DialogTitle>
            <DialogDescription className="text-gray-400">
              Manage your identification documents and driving licenses
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-white rounded-full border-t-transparent"></div>
              </div>
            ) : (
              <>
                {/* Identity Document Container */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50 backdrop-blur-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <CreditCard className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Identity Document</h3>
                        <p className="text-gray-400 text-sm">
                          ID card or Passport issued by your country of residence
                        </p>
                        {renderDocumentStatus("id-document", documents["id-document"])}
                      </div>
                    </div>
                    <Button
                      onClick={handleAddIdentity}
                      className={cn(
                        "w-full mt-4 flex items-center justify-center",
                        documents["id-document"]?.url 
                          ? "bg-gray-800/50 hover:bg-gray-700 text-white border-none" 
                          : "bg-white hover:bg-gray-200 text-black border-none"
                      )}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {documents["id-document"]?.url ? "Update Identity Document" : "Add Identity Document"}
                    </Button>
                  </div>
                </motion.div>

                {/* Driving License Container */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50 backdrop-blur-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <Car className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Driving License</h3>
                        <p className="text-gray-400 text-sm">
                          Add your valid driving license or learner's permit
                        </p>
                        {renderDocumentStatus("driving-license", documents["driving-license"])}
                      </div>
                    </div>
                    <Button
                      onClick={handleAddDrivingLicense}
                      className={cn(
                        "w-full mt-4 flex items-center justify-center",
                        documents["driving-license"]?.url 
                          ? "bg-gray-800/50 hover:bg-gray-700 text-white border-none" 
                          : "bg-white hover:bg-gray-200 text-black border-none"
                      )}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {documents["driving-license"]?.url ? "Update Driving License" : "Add Driving License / Permit"}
                    </Button>
                  </div>
                </motion.div>

                {/* Address Container */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-xl border border-gray-800 overflow-hidden bg-gray-900/50 backdrop-blur-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <MapPin className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Residential Address</h3>
                        <p className="text-gray-400 text-sm">
                          Provide your current residential address
                        </p>
                        {documents.address?.verified && (
                          <div className="mt-2 flex items-center text-green-500">
                            <Check className="w-4 h-4 mr-1" />
                            <span className="text-xs">Verified</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={handleAddAddress}
                      className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white border-none flex items-center justify-center"
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Address
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* Close button */}
          <DialogClose className="absolute right-4 top-4">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      {/* Camera Component */}
      {showCamera && (
        <IDCamera
          isOpen={true}
          onClose={() => setShowCamera(null)}
          documentType={showCamera}
          onSuccess={handleDocumentUploaded}
        />
      )}
    </>
  );
}
