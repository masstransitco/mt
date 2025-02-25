"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Plus, CreditCard, MapPin, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LicenseModal({ isOpen, onClose }: LicenseModalProps) {
  const [mounted, setMounted] = React.useState(false);

  // Ensure client-side only rendering
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Placeholder handlers for the buttons
  const handleAddIdentity = () => {
    console.log("Add identity document");
    // Will implement later
  };

  const handleAddDrivingLicense = () => {
    console.log("Add driving license");
    // Will implement later
  };

  const handleAddAddress = () => {
    console.log("Add address");
    // Will implement later
  };

  if (!mounted) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
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
                </div>
              </div>
              <Button
                onClick={handleAddIdentity}
                className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white border-none flex items-center justify-center"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Identity Document
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
                </div>
              </div>
              <Button
                onClick={handleAddDrivingLicense}
                className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-white border-none flex items-center justify-center"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Driving License / Permit
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
  );
}
