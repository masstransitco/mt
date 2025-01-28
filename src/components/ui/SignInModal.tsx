'use client'

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import { Loader2, X } from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';
import PhoneInput from './PhoneInput'; // Ensure this component exists or replace with your own phone input

type AuthStep = 'welcome' | 'phone' | 'verify';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

/* -------------------------------------
 * StepIndicator
 * A simple visual indicator for step progress
 * ------------------------------------- */
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center space-x-2 justify-center py-2">
      {Array.from({ length: totalSteps }, (_, index) => {
        const isActive = index + 1 === currentStep;
        return (
          <div
            key={index}
            className={`h-2 w-2 rounded-full transition-colors ${
              isActive ? 'bg-blue-500 scale-110' : 'bg-gray-500'
            }`}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------
 * PinInput
 * A 6-digit input for verification codes.
 * Automatically advances focus.
 * ------------------------------------- */
function PinInput({
  length,
  loading,
  onChange,
}: {
  length: number;
  loading: boolean;
  onChange: (code: string) => void;
}) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<HTMLInputElement[]>([]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);
    onChange(newValues.join(''));

    // Move to next input if user typed a digit
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      // Move focus backward if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Reset local pin state if we exit or re-enter verification
  useEffect(() => {
    if (!loading) {
      setValues(Array(length).fill(''));
    }
  }, [loading, length]);

  return (
    <div className="flex space-x-2">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          type="text"
          maxLength={1}
          value={values[index]}
          disabled={loading}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          ref={(el) => {
            if (el) inputRefs.current[index] = el;
          }}
          className="w-10 h-12 text-center border border-border bg-background
                     text-white text-xl rounded-md focus:outline-none
                     focus:ring focus:ring-blue-500 disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer for "Resend Code"
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  /* -------------------------------------
   * Handle countdown for re-sending code
   * ------------------------------------- */
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    if (!canResend && step === 'verify') {
      timerId = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timerId as NodeJS.Timeout);
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

  /* -------------------------------------
   * If user is already signed in, close
   * the modal
   * ------------------------------------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        handleClose();
      }
    });
    return () => {
      unsubscribe();
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    };
  }, []);

  const handleClose = () => {
    // Reset all states
    setStep('welcome');
    setPhoneNumber('');
    setVerificationCode('');
    setError(null);
    setLoading(false);
    setResendTimer(30);
    setCanResend(false);
    onClose();
  };

  /* -------------------------------------
   * Step: Phone Number -> Send SMS
   * ------------------------------------- */
  const handlePhoneSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      // Clear old recaptcha if any
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }

      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved, proceed
          },
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please try again.');
            setLoading(false);
          },
        }
      );

      // Send SMS
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;

      // Move to verify step
      setStep('verify');
      setResendTimer(30);
      setCanResend(false);
    } catch (err: any) {
      console.error('Phone sign-in error:', err);
      let errorMessage =
        'We could not send the verification code. Please check your number and try again.';

      if (err.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number. Please enter a valid number.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------
   * Step: Verify code
   * ------------------------------------- */
  const handleVerifyCode = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.confirmationResult) {
        throw new Error('No verification code was sent.');
      }

      await window.confirmationResult.confirm(verificationCode);
      // onAuthStateChanged will handle success
    } catch (err: any) {
      console.error('Code verification error:', err);
      let errorMessage = 'Failed to verify code. Please check and try again.';

      if (err.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid code. Please check and try again.';
      } else if (err.code === 'auth/code-expired') {
        errorMessage = 'Code expired. Please request a new one.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------
   * Step: Resend Code
   * ------------------------------------- */
  const handleResendCode = () => {
    setVerificationCode('');
    setStep('phone');
  };

  /* -------------------------------------
   * Step indicators
   * ------------------------------------- */
  const currentStepNumber = step === 'welcome' ? 1 : step === 'phone' ? 1 : 2;
  const totalSteps = 2; // phone + verify

  /* -------------------------------------
   * RENDER: Welcome Step
   * ------------------------------------- */
  const renderWelcomeContent = () => (
    <div
      key="welcome"
      className="flex flex-col h-full overflow-hidden transition-opacity duration-300"
    >
      <div className="relative w-full h-[28vh] shrink-0">
        <video
          src="/brand/drive.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
          <h2 className="text-[28px] font-semibold text-white leading-tight mb-2">
            Welcome to Mass Transit
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-4 text-white/80">
        <div className="space-y-2 text-[15px] leading-snug">
          <p>• Drive the MG4 Electric, Maxus MIFA7, and the Cyberquad.</p>
          <p>• Access 150+ stations with seamless entry and exit.</p>
          <p>• No deposits. Daily fares capped at $400.</p>
        </div>
        <p className="text-[13px] text-white/60 leading-relaxed">
          By clicking "Continue," you confirm you're 18 or older with a valid
          driver’s license or permit. Trip and driving data may be collected
          to improve services. See our{' '}
          <a
            href="/privacy"
            className="text-[#0080ff] underline"
            target="_blank"
            rel="noreferrer"
          >
            Privacy Policy
          </a>{' '}
          for details.
        </p>
        <button
          onClick={() => setStep('phone')}
          disabled={loading}
          className="w-full py-3.5 mt-1 rounded-xl bg-[#0080ff]
                     text-white text-[15px] font-medium
                     active:opacity-90 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );

  /* -------------------------------------
   * RENDER: Phone Input Step
   * ------------------------------------- */
  const renderPhoneInput = () => (
    <div
      key="phone-input"
      className="flex flex-col h-full transition-opacity duration-300"
    >
      <div className="flex-1 p-6 space-y-4">
        <h3 className="text-xl font-semibold text-white">Enter Your Phone Number</h3>
        <StepIndicator currentStep={currentStepNumber} totalSteps={totalSteps} />
        <p className="text-sm text-gray-300">
          We’ll text you a verification code to ensure it’s really you.
        </p>
        <PhoneInput
          value={phoneNumber}
          onChange={setPhoneNumber}
          disabled={loading}
        />
        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg">
            {error}
          </div>
        )}
        <div id="recaptcha-container" />
      </div>

      <div className="p-6 pt-0 space-y-3">
        <button
          onClick={handlePhoneSignIn}
          disabled={loading || !phoneNumber || phoneNumber.length < 8}
          className="w-full p-4 rounded-lg bg-primary
                     text-primary-foreground hover:bg-primary/90
                     disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            'Send Code'
          )}
        </button>
        <button
          onClick={() => setStep('welcome')}
          disabled={loading}
          className="w-full p-3 text-sm
                     text-gray-400 hover:text-gray-200
                     disabled:opacity-50"
        >
          Back
        </button>
      </div>
    </div>
  );

  /* -------------------------------------
   * RENDER: Code Verification Step
   * ------------------------------------- */
  const renderVerification = () => (
    <div
      key="verification"
      className="flex flex-col h-full transition-opacity duration-300"
    >
      <div className="flex-1 p-6 space-y-4">
        <h3 className="text-xl font-semibold text-white">Verify Your Number</h3>
        <StepIndicator currentStep={currentStepNumber} totalSteps={totalSteps} />
        <p className="text-sm text-gray-300">
          Enter the 6-digit code we sent to{' '}
          <span className="font-medium">{phoneNumber}</span>.
        </p>

        <PinInput
          length={6}
          loading={loading}
          onChange={(code) => setVerificationCode(code)}
        />

        {error && (
          <div className="p-3 text-sm text-red-400 bg-red-500/10 rounded-lg">
            {error}
          </div>
        )}

        {!canResend && (
          <p className="text-xs text-gray-400">
            If you don’t receive the code, you can resend in {resendTimer}s
          </p>
        )}
        {canResend && (
          <button
            onClick={handleResendCode}
            className="text-sm underline text-blue-400"
          >
            Resend code
          </button>
        )}
      </div>

      <div className="p-6 pt-0 space-y-3">
        <button
          onClick={handleVerifyCode}
          disabled={loading || verificationCode.length !== 6}
          className="w-full p-4 rounded-lg bg-primary
                     text-primary-foreground hover:bg-primary/90
                     disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : (
            'Verify Code'
          )}
        </button>
        <button
          onClick={() => setStep('phone')}
          disabled={loading}
          className="w-full p-3 text-sm
                     text-gray-400 hover:text-gray-200
                     disabled:opacity-50"
        >
          Change Phone Number
        </button>
      </div>
    </div>
  );

  /* -------------------------------------
   * FINAL RENDER
   * ------------------------------------- */
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="
          fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
          w-full max-w-[448px] max-h-[90vh] overflow-hidden
          bg-[#111111] border border-border/40 rounded-2xl p-0 gap-0
        "
      >
        <DialogHeader className="absolute right-4 top-4 z-10">
          <button
            aria-label="Close sign-in modal"
            onClick={handleClose}
            className="
              rounded-full p-2 bg-black/20 backdrop-blur-sm
              hover:bg-black/30 transition-colors
            "
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </DialogHeader>

        {step === 'welcome' && renderWelcomeContent()}
        {step === 'phone' && renderPhoneInput()}
        {step === 'verify' && renderVerification()}
      </DialogContent>
    </Dialog>
  );
}
