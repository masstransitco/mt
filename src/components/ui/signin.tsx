// src/components/ui/signin.tsx

import React, { useEffect, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  // ...other imports
} from "firebase/auth";
import { auth } from "@/lib/firebase";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: any;
  }
}

export default function SignIn() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !window.recaptchaVerifier) {
      // The constructor signature is:
      //   new RecaptchaVerifier(containerOrId, parameters, auth)
      window.recaptchaVerifier = new RecaptchaVerifier(
        "recaptcha-container",
        {
          size: "invisible",
          callback: (response: any) => {
            // reCAPTCHA solved
          },
        },
        auth // from getAuth(app)
      );
    }
  }, []);

  const sendVerificationCode = async () => {
    if (!window.recaptchaVerifier) return;
    try {
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;
    } catch (error) {
      console.error("SMS error", error);
    }
  };

  // ...
  return (
    <div>
      <input
        type="tel"
        placeholder="+1 555 123 4567"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
      />
      <button onClick={sendVerificationCode}>Send Code</button>
      {/* reCAPTCHA container */}
      <div id="recaptcha-container" />
    </div>
  );
}
