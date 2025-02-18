"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2, X } from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import PhoneInput from "./PhoneInput";

// Add proper type definitions for window
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
    confirmationResult: ConfirmationResult;
  }
}

// Dynamically import ReactPlayer with loading state
const ReactPlayer = dynamic(() => import("react-player"), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 animate-pulse" />
});

type AuthStep = "welcome" | "phone" | "verify";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center space-x-2 py-2">
      {Array.from({ length: totalSteps }, (_, index) => (
        <div
          key={index}
          className={`h-2 w-2 rounded-full transition-colors ${
            index + 1 === currentStep ? "bg-blue-500 scale-110" : "bg-gray-400"
          }`}
        />
      ))}
    </div>
  );
}

function PinInput({
  length,
  loading,
  onChange,
}: {
  length: number;
  loading: boolean;
  onChange: (code: string) => void;
}) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);
    onChange(newValues.join(""));

    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    if (!loading) {
      setValues(Array(length).fill(""));
      // Focus first input when resetting
      inputRefs.current[0]?.focus();
    }
  }, [loading, length]);

  return (
    <div className="flex space-x-2">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          disabled={loading}
          value={values[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          className="w-10 h-12 text-center border border-gray-300 bg-white
                     text-gray-900 text-xl rounded-md focus:outline-none
                     focus:ring focus:ring-blue-500 disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [step, setStep] = useState<AuthStep>("welcome");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Cleanup function
  const cleanup = () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      delete window.recaptchaVerifier;
    }
  };

  useEffect(() => {
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

      // Create new reCAPTCHA instance
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible",
          callback: () => {},
          "expired-callback": () => {
            setError("reCAPTCHA expired. Please try again.");
            setLoading(false);
          },
        }
      );

      await window.recaptchaVerifier.render();
      
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative w-11/12 max-w-2xl mx-4 my-4 bg-gray-200/90 backdrop-blur-sm
                      shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[80vh]">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-full bg-gray-800 
                     hover:bg-gray-700 z-10"
          aria-label="Close modal"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="flex-1 flex flex-col min-h-0">
          {step === "welcome" && (
            <div className="flex flex-col h-full">
              <div className="relative w-full h-[28vh] shrink-0">
                <ReactPlayer
                  url="/brand/drive.mp4"
                  playing
                  muted
                  loop
                  controls={false}
                  width="100%"
                  height="100%"
                  style={{ objectFit: "cover" }}
                  config={{
                    file: {
                      attributes: {
                        playsInline: true,
                      },
                    },
                  }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(180deg, transparent 0%, rgba(229,231,235,0.9) 80%)"
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <h2 className="text-xl font-semibold text-gray-900 drop-shadow">
                    Welcome to Mass Transit
                  </h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 text-gray-900 space-y-4 text-sm">
                <p>• Drive the MG4 Electric, Maxus MIFA7, and the Cyberquad.</p>
                <p>• Access 150+ stations with seamless entry and exit.</p>
                <p>• No deposits. Daily fares capped at $400.</p>
                <p className="text-xs text-gray-700 leading-relaxed">
                  By clicking "Continue," you confirm you're 18 or older with a valid
                  driver's license or permit. Trip and driving data may be collected
                  to improve services. See our{" "}
                  <a
                    href="/privacy"
                    className="text-blue-500 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Privacy Policy
                  </a>{" "}
                  for details.
                </p>
                <button
                  onClick={() => setStep("phone")}
                  disabled={loading}
                  className="w-full py-3 mt-1 rounded-md bg-blue-600 text-white 
                           text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === "phone" && (
            <div className="flex flex-col h-full">
              <div className="flex-1 p-6 space-y-4 text-gray-900 text-sm">
                <h3 className="text-lg font-semibold">Enter Your Phone Number</h3>
                <StepIndicator currentStep={1} totalSteps={2} />
                <p>We'll text you a verification code to ensure it's really you.</p>
                <PhoneInput 
                  value={phoneNumber} 
                  onChange={setPhoneNumber} 
                  disabled={loading} 
                />
                {error && (
                  <div className="p-3 text-sm text-red-500 bg-red-100 rounded-lg">
                    {error}
                  </div>
                )}
                <div id="recaptcha-container" />
              </div>

              <div className="p-6 pt-0 space-y-3">
                <button
                  onClick={handlePhoneSignIn}
                  disabled={loading || !phoneNumber || phoneNumber.length < 8}
                  className="w-full p-3 rounded-md bg-blue-600 text-white text-sm
                           font-medium hover:bg-blue-500 disabled:opacity-50
                           transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Send Code"
                  )}
                </button>
                <button
                  onClick={() => setStep("welcome")}
                  disabled={loading}
                  className="w-full p-3 text-sm text-gray-500 hover:text-gray-700
                           disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {step === "verify" && (
            <div className="flex flex-col h-full">
              <div className="flex-1 p-6 space-y-4 text-gray-900 text-sm">
                <h3 className="text-lg font-semibold">Verify Your Number</h3>
                <StepIndicator currentStep={2} totalSteps={2} />
                <p>
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-medium">{phoneNumber}</span>
                </p>

                <PinInput
                  length={6}
                  loading={loading}
                  onChange={setVerificationCode}
                />

                {error && (
                  <div className="p-3 text-sm text-red-500 bg-red-100 rounded-lg">
                    {error}
                  </div>
                )}
                {!canResend && (
                  <p className="text-xs text-gray-500">
                    Didn't get the code? You can resend in {resendTimer}s
                  </p>
                )}
                {canResend && (
                  <button
                    onClick={handleResendCode}
                    className="text-sm underline text-blue-500"
                  >
                    Resend code
                  </button>
                )}
              </div>

              <div className="p-6 pt-0 space-y-3">
                <button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full p-3 rounded-md bg-blue-600 text-white text-sm
                           font-medium hover:bg-blue-500 disabled:opacity-50
                           transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Verify Code"
                  )}
                </button>
                <button
                  onClick={() => setStep("phone")}
                  disabled={loading}
                  className="ww-full p-3 text-sm text-gray-500 hover:text-gray-700
                           disabled:opacity-50"
                >
                  Change Phone Number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
