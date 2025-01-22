// src/components/ui/signin.tsx
import React, { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { auth } from "@/lib/firebase"; // Make sure this points to the file above

export default function SignIn() {
  // ------------------------------
  //              STATE
  // ------------------------------
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ------------------------------
  //         SETUP reCAPTCHA
  // ------------------------------
  useEffect(() => {
    // This runs only in the browser
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      // The constructor signature is:
      //   new RecaptchaVerifier(containerOrId, parameters, authExtern)
      window.recaptchaVerifier = new RecaptchaVerifier(
        "recaptcha-container",  // <-- string container ID or HTMLElement
        {
          size: "invisible",    // "normal" or "invisible"
          callback: (response: any) => {
            // reCAPTCHA solved, allow signInWithPhoneNumber
          },
        },
        auth // <-- your Auth instance
      );
    }
  }, []);

  // ------------------------------
  //        GOOGLE SIGN-IN
  // ------------------------------
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      alert("Signed in with Google!");
    } catch (error) {
      console.error("Google sign-in error:", error);
      alert("Error signing in with Google");
    }
  };

  // ------------------------------
  //         PHONE SIGN-IN
  // ------------------------------
  const sendVerificationCode = async () => {
    try {
      // Check the reCAPTCHA
      const appVerifier = window.recaptchaVerifier;
      if (!appVerifier) {
        alert("reCAPTCHA not ready.");
        return;
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        appVerifier
      );
      // Store the confirmationResult in window to verify later
      window.confirmationResult = confirmationResult;
      alert("SMS verification code sent!");
    } catch (error) {
      console.error("Phone sign-in error:", error);
      alert("Error sending SMS");
    }
  };

  const verifyCode = async () => {
    try {
      if (!window.confirmationResult) {
        alert("No confirmation result. Send code first.");
        return;
      }
      // If successful, user is now signed in
      await window.confirmationResult.confirm(verificationCode);
      alert("Phone number verified!");
    } catch (error) {
      console.error("Verify code error:", error);
      alert("Invalid verification code");
    }
  };

  // ------------------------------
  //    EMAIL/PASSWORD SIGN-IN
  // ------------------------------
  const handleEmailSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Signed in with email!");
    } catch (error) {
      console.error("Email sign-in error:", error);
      alert("Error signing in with email");
    }
  };

  // ------------------------------
  //    EMAIL/PASSWORD SIGN-UP
  // ------------------------------
  const handleEmailSignUp = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account created!");
    } catch (error) {
      console.error("Email sign-up error:", error);
      alert("Error creating account");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Sign In Page</h1>

      {/* Google Sign In */}
      <div className="mb-6">
        <button
          onClick={handleGoogleSignIn}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Sign in with Google
        </button>
      </div>

      {/* Phone Sign In */}
      <div className="mb-6">
        <label className="block mb-1">Phone Number</label>
        <input
          type="tel"
          placeholder="+1 555 123 4567"
          className="border p-2 w-full mb-2"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />

        <button
          onClick={sendVerificationCode}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Send Verification Code
        </button>

        <div className="mt-4">
          <label className="block mb-1">Verification Code</label>
          <input
            type="text"
            placeholder="Enter code"
            className="border p-2 w-full mb-2"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
          />

          <button
            onClick={verifyCode}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Verify Code
          </button>
        </div>

        {/* This container is required by reCAPTCHA */}
        <div id="recaptcha-container" />
      </div>

      {/* Email/Password Sign In & Sign Up */}
      <div className="mb-6">
        <label className="block mb-1">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          className="border p-2 w-full mb-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block mb-1">Password</label>
        <input
          type="password"
          placeholder="********"
          className="border p-2 w-full mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="space-x-2">
          <button
            onClick={handleEmailSignIn}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Sign In
          </button>
          <button
            onClick={handleEmailSignUp}
            className="bg-purple-500 text-white px-4 py-2 rounded"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
