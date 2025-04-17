"use client";

import React from 'react';

// Simple fallback components that can be used when Three.js fails to load

export const FallbackContainer: React.FC<{
  width?: string | number;
  height?: string | number;
  children?: React.ReactNode;
  className?: string;
}> = ({ width = '100%', height = '100%', children, className = '' }) => {
  return (
    <div 
      style={{ 
        width, 
        height,
        background: '#1a1a1a',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
      }}
      className={`fallback-container flex items-center justify-center ${className}`}
    >
      {children}
    </div>
  );
};

export const CarSceneFallback: React.FC<{
  message?: string;
  width?: string | number;
  height?: string | number;
}> = ({ message = 'Unable to load 3D scene', width = '100%', height = '15rem' }) => {
  return (
    <FallbackContainer width={width} height={height}>
      <div className="px-4 py-2 bg-black/40 rounded-full text-white/80 text-sm">
        {message}
      </div>
    </FallbackContainer>
  );
};

export default {
  FallbackContainer,
  CarSceneFallback
};