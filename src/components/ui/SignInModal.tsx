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

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
    confirmationResult: any;
  }
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
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider).catch((error) => {
        if (error.code === 'auth/popup-closed-by-user') {
          return null;
        }
        throw error;
      });

      if (!result) {
        // User closed popup - no error needed
        return;
      }

    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      let errorMessage = 'Failed to sign in with Google. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up was blocked. Please enable pop-ups and try again.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in was interrupted. Please try again.';
          break;
        case 'auth/popup-closed-by-user':
          return; // Don't show error
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
        default:
          errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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
      console.error('Email auth error:', error);
      let errorMessage = 'Authentication failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'Invalid email or password.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Email already registered. Please sign in instead.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Please try again later.';
          break;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderMethodSelection = () => (
    <div className="grid gap-4">
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50 transition-colors"
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
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50 transition-colors"
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
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10 disabled:opacity-50 transition-colors"
      >
        <Mail className="w-5 h-5" />
        <span>Continue with Email</span>
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
              className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                authAction === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </button>
            <button
              onClick={() => {
                setAuthAction(authAction === 'signin' ? 'signup' : 'signin');
              }}
              disabled={loading}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {authAction === 'signin' ? 'Create an account' : 'Already have an account?'}
            </button>
            <button
              onClick={() => setSelectedMethod(null)}
              disabled={loading}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Back to sign in options
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
              Back to sign in options
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
              Back to phone number
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
