"use client";

import { useEffect, useState } from 'react';

type OS = 'iOS' | 'Android' | 'Windows' | 'macOS' | 'Linux' | 'unknown';
type Browser = 'Safari' | 'Chrome' | 'Firefox' | 'Edge' | 'Opera' | 'Samsung' | 'unknown';

export function useDeviceDetection() {
  const [os, setOS] = useState<OS>('unknown');
  const [browser, setBrowser] = useState<Browser>('unknown');
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);
  
  useEffect(() => {
    // Detect operating system
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    
    // Detect OS
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      setOS('iOS');
    } else if (/android/i.test(userAgent)) {
      setOS('Android');
    } else if (/Win/.test(userAgent)) {
      setOS('Windows');
    } else if (/Mac/.test(userAgent) && !/iPad|iPhone|iPod/.test(userAgent)) {
      setOS('macOS');
    } else if (/Linux/.test(userAgent)) {
      setOS('Linux');
    }
    
    // Detect browser
    if (/CriOS/i.test(userAgent)) {
      // Chrome on iOS
      setBrowser('Chrome');
    } else if (/FxiOS/i.test(userAgent)) {
      // Firefox on iOS
      setBrowser('Firefox');
    } else if (/EdgiOS/i.test(userAgent)) {
      // Edge on iOS
      setBrowser('Edge');
    } else if (/SamsungBrowser/i.test(userAgent)) {
      // Samsung Internet
      setBrowser('Samsung');
    } else if (/OPiOS/i.test(userAgent)) {
      // Opera on iOS
      setBrowser('Opera');
    } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
      // Safari (must check before Chrome as Chrome includes Safari in UA)
      setBrowser('Safari');
    } else if (/Chrome/i.test(userAgent)) {
      // Chrome on other platforms
      setBrowser('Chrome');
    } else if (/Firefox/i.test(userAgent)) {
      // Firefox on other platforms
      setBrowser('Firefox');
    } else if (/Edg/i.test(userAgent)) {
      // Edge on other platforms
      setBrowser('Edge');
    } else if (/Opera|OPR/i.test(userAgent)) {
      // Opera on other platforms
      setBrowser('Opera');
    }
    
    // Check if running in standalone/installed PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsInStandaloneMode(isStandalone);
  }, []);
  
  return { os, browser, isInStandaloneMode };
}
