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
import { X, Plus, CreditCard, MapPin, Car, Check, AlertCircle, Eye, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { auth } from "@/lib/firebase";
import { doc, getFirestore, getDoc } from "firebase/firestore";
import IDCamera from "./IDCamera";
import AddressInput from "./AddressInput";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DocumentStatus {
  url?: string;
  uploadedAt?: number;
  verified?: boolean;
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

interface UserDocuments {
  "id-document"?: DocumentStatus;
  "driving-license"?: DocumentStatus;
  address?: Address;
}

export default function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [mounted, setMounted] = useState(false);
  const [showCamera, setShowCamera] = useState<"identity" | "license" | null>(null);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [documents, setDocuments] = useState<UserDocuments>({});
  const [loading, setLoading] = useState(true);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);

  const db = getFirestore();

  React.useEffect(() => {
    setMounted(true);
    if (isOpen && auth.currentUser) {
      fetchUserDocuments();
    }
  }, [isOpen]);

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

  const handleAddIdentity = () => {
    setShowCamera("identity");
  };

  const handleAddDrivingLicense = () => {
    setShowCamera("license");
  };

  const handleAddAddress = () => {
    setShowAddressInput(true);
  };

  const handleDocumentUploaded = () => {
    fetchUserDocuments();
  };

  const handleViewDocument = (docType: "id-document" | "driving-license") => {
    if (documents[docType]?.url) {
      setViewingDocument(documents[docType]?.url || null);
    }
  };

  const formatAddress = (address?: Address) => {
    if (!address) return null;
    const parts = [
      address.flat ? `Flat ${address.flat}` : "",
      address.floor ? `Floor ${address.floor}` : "",
      address.block ? `${address.block}` : "",
      address.fullAddress,
    ].filter(Boolean);
    return parts.join(", ");
  };

  if (!mounted) return null;

  const renderDocumentStatus = (
    type: "id-document" | "driving-license",
    document?: DocumentStatus
  ) => {
    if (!document || !document.url) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-col">
        <button
          onClick={() => handleViewDocument(type)}
          className="text-white underline decoration-dotted hover:text-blue-300 text-sm text-left mb-1 flex items-center"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          View your {type === "id-document" ? "ID card" : "driving license or permit"}
        </button>
        <div className="flex items-center">
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
      </div>
    );
  };

  return (
    <>
      <Dialog
        open={isOpen && !showCamera && !showAddressInput}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className={cn(
            // Set modal to 95% of viewport width/height and remove padding
            "p-0 gap-0",
            "w-[95vw] h-[95vh]",
            "overflow-hidden bg-black text-white"
          )}
        >
          {/* Remove horizontal/vertical padding from header */}
          <DialogHeader className="border-b border-gray-800">
            <DialogTitle className="text-white text-lg font-medium">License & ID</DialogTitle>
            <DialogDescription className="text-gray-400">
              Manage your identification documents and driving licenses
            </DialogDescription>
          </DialogHeader>

          {/* Remove the px-6 / py-4 from the content container */}
          <div className="space-y-4 overflow-y-auto max-h-full">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-8 w-8 border-2 border-white rounded-full border-t-transparent"></div>
              </div>
            ) : (
              <>
                {/* Identity Document */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="m-4 rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm"
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
                      {documents["id-document"]?.url
                        ? "Update Identity Document"
                        : "Add Identity Document"}
                    </Button>
                  </div>
                </motion.div>

                {/* Driving License */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="m-4 rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm"
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
                      {documents["driving-license"]?.url
                        ? "Update Driving License"
                        : "Add Driving License / Permit"}
                    </Button>
                  </div>
                </motion.div>

                {/* Address */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="m-4 rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-gray-800 p-3 rounded-lg">
                        <MapPin className="w-6 h-6 text-gray-300" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Residential Address</h3>
                        {documents.address ? (
                          <div>
                            <p className="text-sm text-white break-words">
                              {formatAddress(documents.address)}
                            </p>
                            <div className="mt-2 flex items-center">
                              {documents.address.verified ? (
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
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm">
                            Provide your current residential address
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={handleAddAddress}
                      className={cn(
                        "w-full mt-4 flex items-center justify-center",
                        documents.address
                          ? "bg-gray-800/50 hover:bg-gray-700 text-white border-none"
                          : "bg-white hover:bg-gray-200 text-black border-none"
                      )}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {documents.address ? "Update Address" : "Add Address"}
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </div>

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

      {showCamera && (
        <IDCamera
          isOpen={true}
          onClose={() => setShowCamera(null)}
          documentType={showCamera}
          onSuccess={handleDocumentUploaded}
        />
      )}

      {showAddressInput && (
        <AddressInput
          isOpen={true}
          onClose={() => setShowAddressInput(false)}
          onSuccess={handleDocumentUploaded}
        />
      )}

      <Dialog
        open={!!viewingDocument}
        onOpenChange={(open) => {
          if (!open) setViewingDocument(null);
        }}
      >
        <DialogContent
          className={cn(
            "p-0 gap-0",
            "w-[95vw] h-[95vh]",
            "overflow-hidden bg-black text-white"
          )}
        >
          <DialogHeader className="border-b border-gray-800">
            <DialogTitle className="text-white text-lg font-medium">
              {viewingDocument?.includes("id-document") ? "Identity Document" : "Driving License"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-hidden">
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-900/30 backdrop-blur">
              {viewingDocument && (
                <img
                  src={viewingDocument}
                  alt="Document"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                className="text-white border-gray-700"
                onClick={() => setViewingDocument(null)}
              >
                Close
              </Button>
              <Button
                variant="outline"
                className="text-white border-gray-700"
                onClick={() => {
                  if (viewingDocument) {
                    window.open(viewingDocument, "_blank");
                  }
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
