// src/types/global.d.ts
export {};

declare global {
  interface Window {
    recaptchaVerifier?: import("firebase/auth").RecaptchaVerifier;
    confirmationResult?: import("firebase/auth").ConfirmationResult;
    
    // Animation state for THREE.js rendering
    __threeAnimations?: {
      [key: string]: {
        startTime: number;
        duration: number;
        isActive: boolean;
        carFront?: THREE.Vector3;
      }
    };
    __lastRenderTime?: number;
  }
}
