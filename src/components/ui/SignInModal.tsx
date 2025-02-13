"use client";

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
import PhoneInput from './PhoneInput';

// 1) Import your userSlice actions
import { useAppDispatch } from '@/store/store';
import { setAuthUser } from '@/store/userSlice'; // <--- Must exist in your userSlice

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

/* StepIndicator, PinInput same as before... */

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const dispatch = useAppDispatch(); // <-- We'll dispatch setAuthUser here

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
   * the modal, but also store user in Redux
   * ------------------------------------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // 2) Extract the fields you want from firebaseUser
        const { uid, phoneNumber, email, displayName } = firebaseUser;

        // 3) Dispatch setAuthUser to Redux
        dispatch(
          setAuthUser({
            uid,
            phoneNumber: phoneNumber ?? undefined,
            email: email ?? undefined,
            displayName: displayName ?? undefined,
          })
        );

        // Then close the modal
        handleClose();
      } else {
        // If user is null => optional: dispatch setAuthUser(null)
        // dispatch(setAuthUser(null));
      }
    });
    return () => {
      unsubscribe();
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    };
  }, [dispatch]);

  /* Close modal => reset states */
  const handleClose = () => {
    setStep('welcome');
    setPhoneNumber('');
    setVerificationCode('');
    setError(null);
    setLoading(false);
    setResendTimer(30);
    setCanResend(false);

    // Finally call parent's onClose
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
      // onAuthStateChanged will handle success => dispatch + handleClose
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

  /* Step indicators */
  const currentStepNumber = step === 'welcome' ? 1 : step === 'phone' ? 1 : 2;
  const totalSteps = 2; // phone + verify

  /* -------------------------------------
   * RENDER: Welcome Step
   * ------------------------------------- */
  const renderWelcomeContent = () => {
    // ... same as your code ...
  };

  /* -------------------------------------
   * RENDER: Phone Input Step
   * ------------------------------------- */
  const renderPhoneInput = () => {
    // ... same as your code ...
  };

  /* -------------------------------------
   * RENDER: Code Verification Step
   * ------------------------------------- */
  const renderVerification = () => {
    // ... same as your code ...
  };

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
