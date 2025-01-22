// src/types/global.d.ts 

export {};

declare global {
  interface Window {
    recaptchaVerifier?: any;
    confirmationResult?: any;
  }
}
