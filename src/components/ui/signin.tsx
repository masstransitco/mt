'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Mail, Phone, Github } from 'lucide-react';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AuthMethod = 'google' | 'phone' | 'email' | null;
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

  // Reset state when modal closes
  const handleClose = () => {
    setSelectedMethod(null);
    setAuthAction(null);
    setPhoneNumber('');
    setVerificationCode('');
    setEmail('');
    setPassword('');
    onClose();
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      handleClose();
    } catch (error) {
      console.error('Google sign-in error:', error);
    }
  };

  // Phone Sign In
  const handlePhoneSignIn = async () => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          {
            size: 'invisible',
          }
        );
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;
    } catch (error) {
      console.error('Phone sign-in error:', error);
    }
  };

  // Email Sign In/Up
  const handleEmailAuth = async () => {
    try {
      if (authAction === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      handleClose();
    } catch (error) {
      console.error('Email auth error:', error);
    }
  };

  const renderMethodSelection = () => (
    <div className="grid gap-4">
      <button
        onClick={handleGoogleSignIn}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10"
      >
        <img src="/icons/google.svg" alt="Google" className="w-5 h-5" />
        <span>Continue with Google</span>
      </button>

      <button
        onClick={() => setSelectedMethod('phone')}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10"
      >
        <Phone className="w-5 h-5" />
        <span>Continue with Phone</span>
      </button>

      <button
        onClick={() => {
          setSelectedMethod('email');
          setAuthAction(null);
        }}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border hover:bg-accent/10"
      >
        <Mail className="w-5 h-5" />
        <span>Continue with Email</span>
      </button>
    </div>
  );

  const renderEmailActions = () => (
    <div className="grid gap-4">
      <button
        onClick={() => setAuthAction('signin')}
        className="p-3 rounded-lg border border-border hover:bg-accent/10"
      >
        Sign In with Email
      </button>
      <button
        onClick={() => setAuthAction('signup')}
        className="p-3 rounded-lg border border-border hover:bg-accent/10"
      >
        Create New Account
      </button>
      <button
        onClick={() => {
          setSelectedMethod(null);
          setAuthAction(null);
        }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Back to all options
      </button>
    </div>
  );

  const renderEmailForm = () => (
    <div className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 rounded border border-border bg-background"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-2 rounded border border-border bg-background"
      />
      <div className="grid gap-2">
        <button
          onClick={handleEmailAuth}
          className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {authAction === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
        <button
          onClick={() => setAuthAction(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderPhoneForm = () => (
    <div className="space-y-4">
      <input
        type="tel"
        placeholder="+1 (555) 000-0000"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        className="w-full p-2 rounded border border-border bg-background"
      />
      <div className="grid gap-2">
        <button
          onClick={handlePhoneSignIn}
          className="w-full p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Send Code
        </button>
        <button
          onClick={() => setSelectedMethod(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to all options
        </button>
      </div>
      <div id="recaptcha-container" />
    </div>
  );

  const renderContent = () => {
    if (!selectedMethod) {
      return renderMethodSelection();
    }

    if (selectedMethod === 'email' && !authAction) {
      return renderEmailActions();
    }

    if (selectedMethod === 'email' && authAction) {
      return renderEmailForm();
    }

    if (selectedMethod === 'phone') {
      return renderPhoneForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {!selectedMethod
              ? 'Sign In or Create Account'
              : selectedMethod === 'email' && !authAction
              ? 'Choose Email Option'
              : authAction === 'signin'
              ? 'Sign In'
              : authAction === 'signup'
              ? 'Create Account'
              : 'Continue with Phone'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">{renderContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
