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

  useEffect(() => {
    if (isOpen && !cameraStream) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  useEffect(() => {
    if (uploadSuccess) {
      const timer = setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [uploadSuccess, onSuccess, onClose]);

  const startCamera = useCallback(async () => {
    try {
      setCapturedImage(null);
      setPermissionDenied(false);
      setErrorMessage(null);
      
      const constraints = {
        video: { 
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
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

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setIsFrontCamera(!isFrontCamera);
    setTimeout(() => startCamera(), 0);
  }, [isFrontCamera, stopCamera, startCamera]);

  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isFrontCamera) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataURL = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataURL);
      }
    }
  }, [isFrontCamera]);

  const retakeImage = useCallback(() => {
    setCapturedImage(null);
    if (!cameraStream && videoRef.current && !videoRef.current.srcObject) {
      startCamera();
    }
  }, [cameraStream, startCamera]);

  // ***** MAIN CHANGE: after we upload to Firebase, we call our Next.js API with the URL *****
  const handleUpload = useCallback(async () => {
    if (!capturedImage || !auth.currentUser) return;
    setIsUploading(true);
    setErrorMessage(null);
    
    try {
      // 1) Upload to Firebase Storage
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      const userId = auth.currentUser.uid;
      const timestamp = Date.now();
      const docTypeKey = documentType === "identity" ? "id-document" : "driving-license";
      const imageRef = ref(storage, `users/${userId}/${docTypeKey}/${timestamp}.jpg`);
      
      console.log("Attempting to upload to:", `users/${userId}/${docTypeKey}/${timestamp}.jpg`);
      await uploadBytes(imageRef, blob);
      console.log("Storage upload successful");
      
      const downloadURL = await getDownloadURL(imageRef);

      // 2) Update Firestore doc with the new image info
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        await updateDoc(userDocRef, {
          [`documents.${docTypeKey}`]: {
            url: downloadURL,
            uploadedAt: timestamp,
            verified: false
          }
        });
      } else {
        await setDoc(userDocRef, {
          userId,
          documents: {
            [docTypeKey]: {
              url: downloadURL,
              uploadedAt: timestamp,
              verified: false
            }
          }
        });
      }
      console.log("Firestore update successful");
      
      // 3) Call our Next.js API to run Tencent HKIDCardOCR using the public image URL
      if (documentType === "identity") {
        // Only do HKIDCardOCR if it's the identity doc. 
        // For a driving license, you could add a separate route or logic if needed.
        const processRes = await fetch("/api/verification/processDocument", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            docType: docTypeKey,
            imageUrl: downloadURL, // pass the Firebase URL
          }),
        });
        
        const processData = await processRes.json();
        if (!processRes.ok) {
          throw new Error(processData.error || "OCR request failed");
        }
        console.log("OCR success, HKID data:", processData.hkidData);
      }

      // Show success message
      setUploadSuccess(true);
      
    } catch (err) {
      console.error("Error uploading image or processing OCR:", err);
      setErrorMessage(`Upload/OCR failed: ${err instanceof Error ? err.message : "Unknown error"}`);
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
        onClick={(e) => e.stopPropagation()}
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
              
              {/* Camera overlay */}
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
          
          {/* Hidden canvas */}
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
