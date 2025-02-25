"use client";
import React, { Suspense, useCallback, useState, useEffect } from "react";
import { useAppSelector } from "@/store/store";
import { selectAvailableForDispatch } from "@/store/carSlice";
import dynamic from 'next/dynamic';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Dynamic import with loading state
const CarGrid = dynamic(
  () => import("@/components/booking/CarGrid"),
  { 
    ssr: false,
    loading: () => <GridSkeleton />
  }
);

interface CarSheetProps {
  isOpen: boolean;
  onToggle?: () => void;
  className?: string;
}

export default function CarSheet({ isOpen, onToggle, className }: CarSheetProps) {
  const [isContentVisible, setIsContentVisible] = useState(false);
  const availableCars = useAppSelector(selectAvailableForDispatch);
  
  // Handle visibility with proper timing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isOpen) {
      timer = setTimeout(() => {
        setIsContentVisible(true);
      }, 300); // Wait for dialog animation
    } else {
      setIsContentVisible(false);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    onToggle?.();
  }, [onToggle]);

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => !open && handleDismiss()}
    >
      <DialogContent
        className={cn(
          "p-0 gap-0",
          "w-[80vw] max-w-md md:max-w-2xl",
          "overflow-hidden bg-black text-white",
          className
        )}
        onEscapeKeyDown={handleDismiss}
        onInteractOutside={handleDismiss}
      >
        <DialogHeader className="px-6 py-4 border-b border-gray-800">
          <DialogTitle className="text-white text-lg font-medium">Dispatch a car</DialogTitle>
          <DialogDescription className="text-gray-400">
            {availableCars.length} available
          </DialogDescription>
        </DialogHeader>
        
        <div 
          className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]"
          style={{
            overscrollBehavior: 'contain',
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Suspense fallback={<GridSkeleton />}>
              {isContentVisible && (
                <CarGrid 
                  isVisible={isContentVisible}
                  className="pb-4" 
                />
              )}
            </Suspense>
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

const GridSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
    {[...Array(4)].map((_, i) => (
      <div 
        key={i} 
        className="relative h-48 bg-gray-900/50 rounded-lg overflow-hidden border border-gray-800"
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-900/30 via-gray-800/30 to-gray-900/30" />
      </div>
    ))}
  </div>
);
