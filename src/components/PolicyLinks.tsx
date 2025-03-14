"use client";

import React from "react";

interface PolicyLinkProps {
  type: "privacy" | "terms";
  className?: string;
  children?: React.ReactNode;
}

/**
 * Opens the policy page in a new browser window
 * @param type - The type of policy to display ('privacy' or 'terms')
 */
function openPolicyPage(type: 'privacy' | 'terms'): void {
  if (typeof window === 'undefined') return; // Guard for server-side rendering
  
  // Create the URL with the appropriate tab selected
  const baseUrl = window.location.origin;
  const policyUrl = `${baseUrl}/policy?tab=${type}`;
  
  // Open the policy page in a new window or tab
  window.open(policyUrl, '_blank', 'noopener,noreferrer');
}

/**
 * A component for linking to the Privacy Policy or Terms of Service
 */
export function PolicyLink({ type, className, children }: PolicyLinkProps) {
  const defaultText = type === "privacy" ? "Privacy Policy" : "Terms of Service";
  
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    openPolicyPage(type);
  };
  
  return (
    <a 
      href="#"
      className={className || "text-blue-500 hover:underline"}
      onClick={handleClick}
    >
      {children || defaultText}
    </a>
  );
}

/**
 * A component that displays both policy links with a separator
 */
export function PolicyLinks({ className }: { className?: string }) {
  return (
    <div className={`text-xs text-gray-500 ${className || ""}`}>
      By continuing, you agree to our{" "}
      <PolicyLink type="terms">Terms of Service</PolicyLink>{" "}
      and{" "}
      <PolicyLink type="privacy">Privacy Policy</PolicyLink>
    </div>
  );
}