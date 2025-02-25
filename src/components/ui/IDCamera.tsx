"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { auth, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateDoc, doc, getDoc, setDoc, getFirestore } from "firebase/firestore";

interface IDCameraProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  documentType: "identity" | "license";
}

export default function IDCamera({ 
  isOpen, 
  onClose, 
  onSuccess,
  documentType 
}: IDCameraProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const db = getFirestore();
  
  // Document-specific labels
  const documentLabel = documentType === "identity" 
    ? "Identity Document" 
    : "Driving License";

  // Initialize camera when dialog opens
  useEffect(() => {
    if (isOpen && !cameraStream) {
      startCamera();
    }
    
    // Cleanup function to stop camera when component unmounts or dialog closes
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Auto-close after success message
  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess, onSuccess, onClose]);

  // Start camera with current facing mode
  const startCamera = useCallback(async () => {
    try {
      // Reset states
      setCapturedImage(null);
      setPermissionDenied(false);
      setErrorMessage(null);
      
      // Get user media with current camera preference
      const constraints = {
        video: { 
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setPermissionDenied(true);
      } else {
        setErrorMessage("Camera error: Please check your device settings");
      }
    }
  }, [isFrontCamera]);

  // Stop current camera stream
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // Switch between front and back cameras
  const switchCamera = useCallback(() => {
    stopCamera();
    setIsFrontCamera(!isFrontCamera);
    // startCamera will be called by the useEffect due to isFrontCamera change
    setTimeout(() => startCamera(), 0);
  }, [isFrontCamera, stopCamera, startCamera]);

  // Capture current frame from video
  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame on canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // If front camera, flip horizontally for more natural selfie view
        if (isFrontCamera) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL
        const imageDataURL = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataURL);
      }
    }
  }, [isFrontCamera]);

  // Discard captured image and return to camera view
  const retakeImage = useCallback(() => {
    setCapturedImage(null);
    // Ensure camera is running
    if (!cameraStream && videoRef.current && !videoRef.current.srcObject) {
      startCamera();
    }
  }, [cameraStream, startCamera]);

  // Handle uploading the captured image to Firebase
  const handleUpload = useCallback(async () => {
    if (!capturedImage || !auth.currentUser) return;
    
    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      // Convert data URL to Blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Create a reference to the user's document in Firebase Storage
      const userId = auth.currentUser.uid;
      const timestamp = new Date().getTime();
      const docType = documentType === "identity" ? "id-document" : "driving-license";
      const imageRef = ref(storage, `users/${userId}/${docType}/${timestamp}.jpg`);
      
      // Add detailed error logging
      console.log("Attempting to upload to:", `users/${userId}/${docType}/${timestamp}.jpg`);
      
      // Upload image
      await uploadBytes(imageRef, blob);
      console.log("Storage upload successful");
      
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      
      // Check if user document exists in Firestore
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        // Update existing document
        await updateDoc(userDocRef, {
          [`documents.${docType}`]: {
            url: downloadURL,
            uploadedAt: timestamp,
            verified: false
          }
        });
      } else {
        // Create new document
        await setDoc(userDocRef, {
          userId: userId,
          documents: {
            [docType]: {
              url: downloadURL,
              uploadedAt: timestamp,
              verified: false
            }
          }
        });
      }
      
      console.log("Firestore update successful");
      
      // Show success message
      setUploadSuccess(true);
      
    } catch (err) {
      console.error("Error uploading image:", err);
      setErrorMessage(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, documentType, onSuccess]);

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          stopCamera();
          onClose();
        }
      }}
    >
      <DialogContent 
        className="p-0 gap-0 w-[90vw] max-w-md md:max-w-2xl overflow-hidden bg-black text-white"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <DialogHeader className="px-6 py-4 bg-black/90 backdrop-blur-sm border-b border-gray-800 z-10">
          <DialogTitle className="text-white">
            {uploadSuccess 
              ? "Document Uploaded" 
              : capturedImage 
                ? `Confirm ${documentLabel}` 
                : `Capture ${documentLabel}`}
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full aspect-[3/4] bg-black">
          {/* Success message */}
          {uploadSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black"
            >
              <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Upload Successful</h3>
              <p className="text-gray-400">Your document has been saved</p>
            </motion.div>
          )}
        
          {/* Permission denied message */}
          {permissionDenied && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Camera className="h-16 w-16 text-gray-500 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Camera Access Denied</h3>
              <p className="text-gray-400 mb-4">
                Please enable camera access in your browser settings to continue.
              </p>
              <Button 
                onClick={() => {
                  setPermissionDenied(false);
                  startCamera();
                }}
                className="bg-white text-black hover:bg-gray-200"
              >
                Try Again
              </Button>
            </div>
          )}
          
          {/* Error message */}
          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <p className="text-red-400 mb-4">{errorMessage}</p>
              <Button 
                onClick={() => {
                  setErrorMessage(null);
                  startCamera();
                }}
                className="bg-white text-black hover:bg-gray-200"
              >
                Try Again
              </Button>
            </div>
          )}
          
          {/* Camera preview */}
          {!capturedImage && !permissionDenied && !errorMessage && !uploadSuccess && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''}`}
                onCanPlay={() => {
                  if (videoRef.current) {
                    videoRef.current.play().catch(err => console.error("Video play error:", err));
                  }
                }}
              />
              
              {/* Camera overlay and guides */}
              <div className="absolute inset-0 border-2 border-dashed border-white/30 m-6 rounded-md flex items-center justify-center">
                <div className="text-white/70 text-center p-4 bg-black/40 rounded-md">
                  <p>Position your {documentType === "identity" ? "ID" : "license"} within the frame</p>
                  <p className="text-sm">Ensure good lighting and all details are visible</p>
                </div>
              </div>
            </>
          )}
          
          {/* Captured image preview */}
          {capturedImage && !uploadSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
            >
              <img 
                src={capturedImage} 
                alt="Captured document" 
                className="w-full h-full object-contain"
              />
            </motion.div>
          )}
          
          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {!uploadSuccess && (
          <DialogFooter className="p-4 bg-black border-t border-gray-800 flex flex-row justify-between">
            {!capturedImage ? (
              // Camera controls
              <>
                <Button 
                  variant="ghost" 
                  onClick={onClose}
                  className="text-white hover:bg-gray-800"
                >
                  <X className="h-5 w-5 mr-2" />
                  Cancel
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={switchCamera}
                    className="text-white border-gray-700 hover:bg-gray-800"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </Button>
                  
                  <Button 
                    onClick={captureImage}
                    className="bg-white text-black hover:bg-gray-200 min-w-[100px]"
                  >
                    Capture
                  </Button>
                </div>
              </>
            ) : (
              // Confirmation controls
              <>
                <Button 
                  variant="ghost" 
                  onClick={retakeImage}
                  className="text-white hover:bg-gray-800"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Retake
                </Button>
                
                <Button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="bg-white text-black hover:bg-gray-200 min-w-[100px]"
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <span className="animate-spin h-4 w-4 border-2 border-gray-900 rounded-full border-t-transparent mr-2"></span>
                      Uploading...
                    </span>
                  ) : (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Confirm
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
