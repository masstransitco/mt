"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import PhoneInput from "./PhoneInput";
import PinInput from "./PinInput";
import StepIndicator from "./StepIndicator";
import { PolicyLink } from "@/components/PolicyLinks"; // Import the PolicyLink component

interface ExtendedWindow extends Window {
  recaptchaVerifier?: RecaptchaVerifier;
  confirmationResult?: ConfirmationResult;
}

declare let window: ExtendedWindow;

type AuthStep = "welcome" | "phone" | "verify";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [step, setStep] = useState<AuthStep>("welcome");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Clean up any existing reCAPTCHA instance
  const cleanup = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.warn("reCAPTCHA cleanup error:", e);
      }
      window.recaptchaVerifier = undefined;
    }
  };

  useEffect(() => {
    // Listen for auth state changes; close modal if user signs in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        handleClose();
      }
    });
    return () => {
      unsubscribe();
      cleanup();
    };
  }, []);

  const handleClose = () => {
    // Reset all states and close
    setStep("welcome");
    setPhoneNumber("");
    setVerificationCode("");
    setError(null);
    setLoading(false);
    setResendTimer(30);
    setCanResend(false);
    cleanup();
    onClose();
  };
  
  // Handle back button specifically to ensure clean state
  const handleBackToWelcome = () => {
    setPhoneNumber(""); // Clear phone number input
    setError(null);     // Clear any error messages
    cleanup();          // Clean up reCAPTCHA if it exists
    setStep("welcome"); // Set step after clearing data to ensure clean transition
  };

  // Count down for resend
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    if (!canResend && step === "verify") {
      timerId = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [canResend, step]);

  const handlePhoneSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      cleanup();

      console.log("Finding recaptcha-container element");
      const containerElement = document.getElementById("recaptcha-container");
      if (!containerElement) {
        throw new Error("Recaptcha container not found");
      }

      // In Firebase v10, the order is auth, containerElement, config
      console.log("Creating reCAPTCHA verifier");
      const verifier = new RecaptchaVerifier(auth, containerElement, {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {
          setError("reCAPTCHA expired. Please try again.");
          setLoading(false);
        },
      });

      window.recaptchaVerifier = verifier;
      console.log("Rendering reCAPTCHA");
      await verifier.render();

      console.log("Sending verification code to", phoneNumber);
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        verifier
      );
      window.confirmationResult = confirmationResult;
      console.log("Verification code sent successfully");

      console.log("Setting step to verify");
      setStep("verify");
      setResendTimer(30);
      setCanResend(false);
    } catch (err: any) {
      console.error("Phone sign-in error:", err);
      let errorMessage = "We could not send the verification code. Please try again.";
      if (err.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number. Please enter a valid number.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!window.confirmationResult) {
      setError("No verification code was sent. Please request a new code.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await window.confirmationResult.confirm(verificationCode);
    } catch (err: any) {
      console.error("Code verification error:", err);
      let errorMessage = "Failed to verify code. Please try again.";
      if (err.code === "auth/invalid-verification-code") {
        errorMessage = "Invalid code. Please check and try again.";
      } else if (err.code === "auth/code-expired") {
        errorMessage = "Code expired. Please request a new one.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    setVerificationCode("");
    setError(null);
    setStep("phone");
  };

  if (!isOpen) return null;

  // Step number mapping for the StepIndicator
  const getStepNumber = () => {
    switch (step) {
      case "welcome": return 1;
      case "phone": return 2;
      case "verify": return 3;
      default: return 1;
    }
  };

  console.log("Current step:", step);

  return (
    <motion.div 
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-6"
      style={{ 
        pointerEvents: "auto", 
        touchAction: "auto"
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Modal Container */}
      <motion.div
        className="relative w-11/12 max-w-md mx-auto bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Close button */}
        <motion.button
          onClick={handleClose}
          className="absolute right-4 top-4 p-1 rounded-full text-zinc-400 z-[100] hover:bg-zinc-800 hover:text-white transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Step indicator - show on all steps */}
        <div className="pt-6 px-6">
          <StepIndicator currentStep={getStepNumber()} totalSteps={3} />
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait" initial={false} key={step}>
          {/* WELCOME STEP */}
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-medium tracking-tight text-white">Sign in</h2>
                <p className="text-sm text-zinc-400">Access your account to start booking rides</p>
              </div>
              
              <div className="mt-4 space-y-4 text-sm text-zinc-400">
                <p className="leading-relaxed">
                  By clicking "Continue," you confirm you're 18 or older with a valid
                  driver's license or permit. Trip and driving data may be collected
                  to improve services.
                </p>
              </div>
              
              <motion.button
                onClick={() => setStep("phone")}
                className="w-full py-3 mt-4 rounded-lg bg-[#276EF1] text-white font-medium transition-colors hover:bg-[#1E54B7]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Continue
              </motion.button>
              
              <div className="mt-4 text-center">
                <p className="text-xs text-zinc-500">
                  By continuing, you agree to our{" "}
                  <PolicyLink type="terms" className="text-[#276EF1] hover:underline">
                    Terms of Service
                  </PolicyLink>{" "}
                  and{" "}
                  <PolicyLink type="privacy" className="text-[#276EF1] hover:underline">
                    Privacy Policy
                  </PolicyLink>
                </p>
              </div>
            </motion.div>
          )}

          {/* PHONE STEP */}
          {step === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-medium tracking-tight text-white">Enter your phone</h2>
                <p className="text-sm text-zinc-400">We'll text you a verification code</p>
              </div>
              
              <div className="mt-4 space-y-4">
                <PhoneInput value={phoneNumber} onChange={setPhoneNumber} disabled={loading} />
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 text-sm text-red-500 bg-red-900/30 rounded-lg"
                  >
                    {error}
                  </motion.div>
                )}
                <div id="recaptcha-container" className="invisible"></div>
              </div>
              
              <div className="pt-4 space-y-3">
                <motion.button
                  onClick={handlePhoneSignIn}
                  disabled={loading || !phoneNumber || phoneNumber.length < 8}
                  className="w-full p-3 rounded-lg bg-[#276EF1] text-white font-medium transition-colors hover:bg-[#1E54B7] disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={(!loading && phoneNumber && phoneNumber.length >= 8) ? { scale: 1.02 } : {}}
                  whileTap={(!loading && phoneNumber && phoneNumber.length >= 8) ? { scale: 0.98 } : {}}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Send Code"
                  )}
                </motion.button>
                
                <motion.button
                  onClick={handleBackToWelcome}
                  disabled={loading}
                  className="w-full p-3 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Back
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* VERIFY STEP */}
          {step === "verify" && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-4"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-medium tracking-tight text-white">Verification</h2>
                <p className="text-sm text-zinc-400">Enter the 6-digit code sent to {phoneNumber}</p>
              </div>
              
              <div className="mt-6 space-y-6">
                <PinInput length={6} loading={loading} onChange={setVerificationCode} />
                
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 text-sm text-red-500 bg-red-900/30 rounded-lg"
                  >
                    {error}
                  </motion.div>
                )}
                
                <div className="text-center">
                  {!canResend && (
                    <p className="text-sm text-zinc-500">
                      Resend code in <span className="text-[#276EF1]">{resendTimer}s</span>
                    </p>
                  )}
                  {canResend && (
                    <motion.button
                      onClick={handleResendCode}
                      className="text-sm font-medium text-[#276EF1] transition-colors hover:text-[#1E54B7]"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Resend code
                    </motion.button>
                  )}
                </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <motion.button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full p-3 rounded-lg bg-[#276EF1] text-white font-medium transition-colors hover:bg-[#1E54B7] disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={(!loading && verificationCode.length === 6) ? { scale: 1.02 } : {}}
                  whileTap={(!loading && verificationCode.length === 6) ? { scale: 0.98 } : {}}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Verify"
                  )}
                </motion.button>
                
                <motion.button
                  onClick={() => setStep("phone")}
                  disabled={loading}
                  className="w-full p-3 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Change Phone Number
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
