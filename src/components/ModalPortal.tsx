"use client";

import React, { useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * ModalPortal: Renders children into a portal attached to `document.body`
 */
export default function ModalPortal({ children }: { children: ReactNode }) {
  const elRef = useRef<HTMLDivElement | null>(null);

  if (typeof window === "undefined") {
    // If we're on the server, just render nothing
    return null;
  }

  // Create a div for our modal content (only once)
  if (!elRef.current) {
    elRef.current = document.createElement("div");
  }

  useEffect(() => {
    const modalRoot = document.body;
    const el = elRef.current!;
    modalRoot.appendChild(el);
    
    // Cleanup function
    return () => {
      // Check if the element is still a child of modalRoot before removing
      if (el.parentNode === modalRoot) {
        modalRoot.removeChild(el);
      }
    };
  }, []);

  return createPortal(children, elRef.current);
}