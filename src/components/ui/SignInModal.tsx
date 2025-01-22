'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Mail, Phone, Loader2 } from 'lucide-react';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthMethod = 'google' | 'phone' | 'phone-verify' | 'email' | null;
type AuthAction = 'signin' | 'signup' | null;

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod>(null);
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        handleClose();
      }
    });

    return () => unsubscribe();
  }, []);

  const resetState = () => {
    setSelectedMethod(null);
    setAuthAction(null);
    setPhoneNumber('');
    setVerificationCode('');
    setEmail('');
    setPassword('');
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
            callback: () => {
              // reCAPTCHA solved
            }
          }
        );
      }

      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        formattedPhone,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;
      setSelectedMethod('phone-verify');
    } catch (error: any) {
      setError(error.message);
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
      // Auth state listener will handle the redirect
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      if (authAction === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelection = () => (
    <div className="grid gap-4">
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <img src="/icons/google.svg" alt="Google" className="w-5 h-5" />
        )}
        <span>Continue with Google</span>
      </button>

      <button
        onClick={() => setSelectedMethod('phone')}
        disabled={loading}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50"
      >
        <Phone className="w-5 h-5" />
        <span>Continue with Phone</span>
      </button>

      <button
        onClick={() => {
          setSelectedMethod('email');
          setAuthAction('signin');
        }}
        disabled={loading}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50"
      >
        <Mail className="w-5 h-5" />
        <span>Continue with Email</span>
      </button>
    </div>
  );

  const renderError = () => (
    error && (
      <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error}
      </div>
    )
  );

  const renderContent = () => (
    <div className="space-y-4">
      {renderError()}
      
      {!selectedMethod && renderMethodSelection()}
      
      {selectedMethod === 'email' && (
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full p-3 rounded-lg border border-border bg-background disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full p-3 rounded-lg border border-border bg-background disabled:opacity-50"
          />
          <div className="grid gap-2">
            <button
              onClick={handleEmailAuth}
              disabled={loading || !email || !password}
              className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                authAction === 'signin' ? 'Sign In' : 'Create Account'
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
        </div>
      )}

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
              className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
              className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedMethod === 'phone-verify' 
              ? 'Enter Verification Code'
              : selectedMethod === 'phone'
              ? 'Sign in with Phone'
              : selectedMethod === 'email'
              ? authAction === 'signin' ? 'Sign in with Email' : 'Create Account'
              : 'Sign in to continue'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
