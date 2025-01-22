'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Phone, Loader2 } from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthMethod = 'phone' | 'phone-verify' | null;

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

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        handleClose();
      }
    });

    return () => {
      unsubscribe();
      // Cleanup recaptcha when component unmounts
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    };
  }, []);

  const resetState = () => {
    setSelectedMethod(null);
    setPhoneNumber('');
    setVerificationCode('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handlePhoneSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
      
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
          size: 'invisible',
          callback: () => {},
          'expired-callback': () => {
            setError('reCAPTCHA expired. Please try again.');
            setLoading(false);
          }
        }
      );

      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;
      setSelectedMethod('phone-verify');
    } catch (error: any) {
      console.error('Phone sign-in error:', error);
      let errorMessage = 'Failed to send verification code. Please try again.';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number. Please enter a valid number.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!window.confirmationResult) {
        throw new Error('No verification code was sent');
      }

      await window.confirmationResult.confirm(verificationCode);
    } catch (error: any) {
      console.error('Code verification error:', error);
      let errorMessage = 'Failed to verify code. Please try again.';
      
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid code. Please check and try again.';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Code expired. Please request a new one.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelection = () => (
    <div className="grid gap-4">
      <button
        onClick={() => setSelectedMethod('phone')}
        disabled={loading}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50 transition-colors"
      >
        <Phone className="w-5 h-5" />
        <span>Continue with Phone</span>
      </button>
    </div>
  );

  const renderError = () => (
    error && (
      <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
        {error}
      </div>
    )
  );

  const renderContent = () => (
    <div className="space-y-4">
      {renderError()}
      
      {!selectedMethod && renderMethodSelection()}
      
      {selectedMethod === 'phone' && (
        <div className="space-y-4">
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={loading}
            className="w-full p-3 rounded-lg border border-border bg-background disabled:opacity-50"
          />
          <div className="grid gap-2">
            <button
              onClick={handlePhoneSignIn}
              disabled={loading || !phoneNumber}
              className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Send Code'
              )}
            </button>
            <button
              onClick={() => setSelectedMethod(null)}
              disabled={loading}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Back
            </button>
          </div>
          <div id="recaptcha-container" />
        </div>
      )}

      {selectedMethod === 'phone-verify' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter verification code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            disabled={loading}
            className="w-full p-3 rounded-lg border border-border bg-background disabled:opacity-50"
          />
          <div className="grid gap-2">
            <button
              onClick={handleVerifyCode}
              disabled={loading || !verificationCode}
              className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Verify Code'
              )}
            </button>
            <button
              onClick={() => setSelectedMethod('phone')}
              disabled={loading}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md dialog-fullwidth">
        <div className="h-full flex flex-col dialog-content-fullwidth">
          <DialogHeader className="px-4 py-4 border-b border-border">
            <DialogTitle>
              {selectedMethod === 'phone-verify' 
                ? 'Enter Verification Code'
                : selectedMethod === 'phone'
                ? 'Sign in with Phone'
                : 'Sign in to continue'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 p-4 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
