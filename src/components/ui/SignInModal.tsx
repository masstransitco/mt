import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from '@/components/ui/dialog';
import { Phone, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  ConfirmationResult
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import PhoneInput from './PhoneInput';

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
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    };
  }, []);

  const handleClose = () => {
    setSelectedMethod(null);
    setPhoneNumber('');
    setVerificationCode('');
    setError(null);
    setLoading(false);
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

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
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
      // Success is handled by the onAuthStateChanged listener
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

  const renderWelcomeContent = () => (
    <div className="space-y-8">
      <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
        <Image
          src="/brand/drive.gif"
          alt="Welcome Banner"
          fill
          className="object-cover"
          priority
        />
      </div>
      
      <div className="px-6 space-y-6">
        <h2 className="text-2xl font-semibold text-foreground">
          Welcome to Mass Transit
        </h2>
        
        <ul className="space-y-3 text-base text-muted-foreground">
          <li className="flex gap-2">
            • Drive the MG4 Electric, Toyota Vellfire, Maxus MIFA7, and Cyberquad.
          </li>
          <li className="flex gap-2">
            • Enjoy premium travel at lower costs than taxis or rideshares.
          </li>
          <li className="flex gap-2">
            • Access 150+ stations with seamless entry and exit.
          </li>
          <li className="flex gap-2">
            • No deposits. Daily fares capped at $400.
          </li>
        </ul>

        <div className="text-sm text-muted-foreground/80">
          By clicking "Continue," you confirm you're 18 or older with a valid driver's license or permit. Trip and driving data may be collected to improve services. See our{' '}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>{' '}
          for details.
        </div>

        <button
          onClick={() => setSelectedMethod('phone')}
          disabled={loading}
          className="w-full p-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors text-base font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="p-0 gap-0 max-w-md dialog-fullwidth">
        <DialogHeader className="absolute right-4 top-4 z-10">
          <button 
            onClick={handleClose}
            className="rounded-full p-2 bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        <div className="max-h-[85vh] overflow-y-auto">
          {!selectedMethod && renderWelcomeContent()}
          
          {selectedMethod === 'phone' && (
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-semibold">Enter your phone number</h3>
              <PhoneInput
                value={phoneNumber}
                onChange={setPhoneNumber}
                disabled={loading}
              />
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <button
                  onClick={handlePhoneSignIn}
                  disabled={loading || !phoneNumber || phoneNumber.length < 8}
                  className="w-full p-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-semibold">Verify your number</h3>
              <div className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {phoneNumber}
              </div>
              <input
                type="text"
                placeholder="Enter verification code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                className="w-full p-4 rounded-lg border border-border bg-background disabled:opacity-50"
                maxLength={6}
              />
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <button
                  onClick={handleVerifyCode}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full p-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
      </DialogContent>
    </Dialog>
  );
}
