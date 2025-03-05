"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  const [imageBrightness, setImageBrightness] = useState<'low' | 'good' | 'high' | null>(null);
  const [isStable, setIsStable] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stabilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const db = getFirestore();

  // Document-specific labels
  const documentLabel =
    documentType === "identity" ? "Identity Document" : "Driving License";

  // Start/Stop camera as the dialog opens/closes
  useEffect(() => {
    if (isOpen && !cameraStream) {
      startCamera();
    }
    return () => {
      stopCamera();
      if (stabilityTimeoutRef.current) {
        clearTimeout(stabilityTimeoutRef.current);
      }
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

  // Start camera with front/back constraints
  const startCamera = useCallback(async () => {
    try {
      setCapturedImage(null);
      setPermissionDenied(false);
      setErrorMessage(null);
      setImageBrightness(null);
      setIsStable(false);

      const constraints = {
        video: { 
          facingMode: isFrontCamera ? "user" : "environment",
          width: { ideal: 1920 }, // Increased resolution for better OCR
          height: { ideal: 1080 },
          // Request high-quality video if available
          advanced: [
            { frameRate: { min: 20 } },
            { exposureMode: "auto" },
            { focusMode: "continuous" }
          ]
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Start monitoring frame brightness after camera is set up
        if (videoRef.current) {
          // Set a timer to analyze brightness every 1s
          const intervalId = setInterval(() => {
            if (videoRef.current && canvasRef.current) {
              analyzeFrameBrightness();
            }
          }, 1000);
          
          // Clean up on unmount
          return () => {
            clearInterval(intervalId);
          };
        }
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
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setIsFrontCamera(!isFrontCamera);
    setTimeout(() => startCamera(), 0);
  }, [isFrontCamera, stopCamera, startCamera]);

  // Analyze the brightness of the current frame
  const analyzeFrameBrightness = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Sample pixels from the center area (where ID likely is)
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const sampleSize = Math.min(200, Math.floor(canvas.width / 4));
    
    const imageData = ctx.getImageData(
      centerX - sampleSize/2, 
      centerY - sampleSize/2, 
      sampleSize, 
      sampleSize
    );
    
    // Calculate average brightness
    let totalBrightness = 0;
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Convert RGB to brightness (0-255)
      const brightness = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      totalBrightness += brightness;
    }
    
    const avgBrightness = totalBrightness / (data.length / 4);
    
    // Categorize brightness
    if (avgBrightness < 70) {
      setImageBrightness('low');
    } else if (avgBrightness > 200) {
      setImageBrightness('high');
    } else {
      setImageBrightness('good');
      
      // If brightness is good, set a timer to consider the camera stable
      // This helps ensure we capture when conditions are optimal
      if (!isStable) {
        if (stabilityTimeoutRef.current) {
          clearTimeout(stabilityTimeoutRef.current);
        }
        
        stabilityTimeoutRef.current = setTimeout(() => {
          setIsStable(true);
        }, 1000); // Wait 1s of good lighting to consider stable
      }
    }
  }, [isStable]);

  // Enhanced image capture with improved quality
  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (isFrontCamera) {
          // Flip horizontally for front camera
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Apply basic image enhancement for better OCR
        try {
          // Get the image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Simple contrast enhancement
          const contrastFactor = 1.2; // Increase contrast by 20%
          const brightnessFactor = 5; // Slight brightness boost
          
          for (let i = 0; i < data.length; i += 4) {
            // Apply contrast and brightness adjustment to RGB channels
            for (let j = 0; j < 3; j++) {
              // Contrast formula: newValue = (oldValue - 128) * contrastFactor + 128 + brightnessFactor
              data[i + j] = Math.max(0, Math.min(255, 
                (data[i + j] - 128) * contrastFactor + 128 + brightnessFactor
              ));
            }
            // Alpha channel stays the same
          }
          
          // Put the modified image data back
          ctx.putImageData(imageData, 0, 0);
        } catch (err) {
          console.error("Error enhancing image:", err);
          // Continue with the original image if enhancement fails
        }
        
        // High quality JPEG (0.92 gives good balance of quality and file size)
        const imageDataURL = canvas.toDataURL("image/jpeg", 0.92);
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

  // ---------- MAIN LOGIC: Upload to Firebase, then call the OCR API -----------
  const handleUpload = useCallback(async () => {
    if (!capturedImage || !auth.currentUser) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      // 1) Convert data URL to Blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      const userId = auth.currentUser.uid;
      const timestamp = Date.now();
      const docTypeKey = documentType === "identity" ? "id-document" : "driving-license";
      const imageRef = ref(storage, `users/${userId}/${docTypeKey}/${timestamp}.jpg`);

      console.log("Attempting to upload to:", `users/${userId}/${docTypeKey}/${timestamp}.jpg`);
      await uploadBytes(imageRef, blob);
      console.log("Storage upload successful");

      // 2) Get public download URL
      const downloadURL = await getDownloadURL(imageRef);
      console.log("Firebase download URL:", downloadURL);

      // 3) Update Firestore doc with new image info
      const dbRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(dbRef);

      if (userDocSnap.exists()) {
        await updateDoc(dbRef, {
          [`documents.${docTypeKey}`]: {
            url: downloadURL,
            uploadedAt: timestamp,
            verified: false
          }
        });
      } else {
        await setDoc(dbRef, {
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

      // 4) If it's the identity doc, call the OCR
      if (documentType === "identity") {
        console.log("Calling OCR API with URL:", downloadURL);

        try {
          const processRes = await fetch("/api/verification/processDocument", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              docType: docTypeKey,
              imageUrl: downloadURL,
            }),
          });

          const processData = await processRes.json();
          
          if (!processRes.ok) {
            throw new Error(processData.error || "OCR request failed");
          }

          console.log("OCR success, HKID data:", processData.hkidData);
        } catch (ocrError) {
          console.error("OCR processing error:", ocrError);
          // Important: we still continue with success flow even if OCR fails
          // Since the document is already uploaded
          console.log("Document upload was successful despite OCR failure");
          // Don't rethrow - we want to show success for the upload itself
        }
      }

      // Show success regardless of OCR success/failure
      // as long as the document was uploaded
      setUploadSuccess(true);

    } catch (err) {
      console.error("Error uploading image:", err);
      setErrorMessage(`Upload failed: ${
        err instanceof Error ? err.message : "Unknown error"
      }`);
    } finally {
      setIsUploading(false);
    }
  }, [capturedImage, documentType]);

  // Get brightness indicator component
  const getBrightnessIndicator = () => {
    if (!imageBrightness) return null;
    
    let message = "";
    let color = "";
    
    switch (imageBrightness) {
      case 'low':
        message = "Too dark - move to a brighter area";
        color = "text-yellow-500";
        break;
      case 'high':
        message = "Too bright - reduce glare";
        color = "text-yellow-500";
        break;
      case 'good':
        message = "Good lighting";
        color = "text-green-500";
        break;
    }
    
    return (
      <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 ${color} text-xs font-medium`}>
        {message}
      </div>
    );
  };

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

          {/* Permission denied */}
          {permissionDenied && !uploadSuccess && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Camera className="h-16 w-16 text-gray-500 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">
                Camera Access Denied
              </h3>
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
          {errorMessage && !uploadSuccess && (
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
                className={`absolute inset-0 w-full h-full object-cover ${
                  isFrontCamera ? "scale-x-[-1]" : ""
                }`}
                onCanPlay={() => {
                  if (videoRef.current) {
                    videoRef.current
                      .play()
                      .catch((err) => console.error("Video play error:", err));
                  }
                }}
              />

              {/* Brightness indicator */}
              {getBrightnessIndicator()}

              {/* Enhanced camera overlay with corner markers and better guidance */}
              <div className="absolute inset-0 pointer-events-none">
                {/* ID card frame with corner markers */}
                <div className="absolute inset-0 m-6 flex items-center justify-center">
                  {/* Border outline */}
                  <div className={`absolute inset-0 border-2 border-dashed ${isStable ? 'border-green-400/60' : 'border-white/30'} rounded-md`}></div>
                  
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60"></div>
                  
                  {/* Enhanced guidance text */}
                  <div className="text-white/70 text-center p-4 bg-black/40 rounded-md max-w-[80%]">
                    <p className="font-medium mb-1">
                      Position your {documentType === "identity" ? "ID card" : "license"} within the frame
                    </p>
                    <ul className="text-xs text-left list-disc pl-4 space-y-1">
                      <li>Ensure all text is clearly visible</li>
                      <li>Avoid glare and shadows</li>
                      <li>Hold steady for best results</li>
                      <li>Make sure the entire card is visible</li>
                    </ul>
                  </div>
                </div>

                {/* Stability indicator */}
                {isStable && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full bg-green-500/80 text-white text-xs font-medium">
                    Ready to capture
                  </div>
                )}
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

        {/* Footer: capture/retake/upload */}
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
                    className={`bg-white text-black hover:bg-gray-200 min-w-[100px] ${isStable ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
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
