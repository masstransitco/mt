"use client";
import React from "react";
import { Menu as MenuIcon } from "lucide-react";
import { QrCodeIcon } from "@/components/ui/icons/QrCodeIcon";
import { LogoSvg } from "@/components/ui/logo/LogoSvg";

interface HeaderProps {
  onToggleMenu: () => void;
  onScannerOpen: () => void;
}

export function Header({ onToggleMenu, onScannerOpen }: HeaderProps) {
  // Function to log button clicks for debugging
  const logButtonClick = (name: string) => {
    console.log(`Header button clicked: ${name}`);
  };

  return (
    <header
      className="main-header bg-black/90 backdrop-blur-md border-b border-gray-800"
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50px',
        maxHeight: '50px',
        zIndex: 9999,
        pointerEvents: 'auto',
        touchAction: 'auto'
      }}
      onClick={() => console.log("Header clicked")}
    >
      <div 
        className="h-full flex items-center justify-between px-2"
        style={{ pointerEvents: 'auto', touchAction: 'auto' }}
      >
        {/* Left: Logo */}
        <div 
          className="flex items-center"
          style={{ pointerEvents: 'auto', touchAction: 'auto' }}
        >
          <LogoSvg
            aria-label="Logo"
            width={50}
            height={50}
            className="object-contain"
            onClick={() => logButtonClick("Logo")}
          />
        </div>

        {/* Right Icons */}
        <div 
          className="flex items-center space-x-3 mr-1"
          style={{ pointerEvents: 'auto', touchAction: 'auto' }}
        >
          <button
            onClick={() => {
              logButtonClick("Scanner");
              onScannerOpen();
            }}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white bg-gray-800/60 hover:bg-gray-800/80 active:scale-95 transition-all duration-200"
            style={{ pointerEvents: 'auto', touchAction: 'auto', cursor: 'pointer' }}
          >
            <QrCodeIcon className="w-5 h-5" />
          </button>
          {/* Divider */}
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={() => {
              logButtonClick("Menu");
              onToggleMenu();
            }}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white bg-gray-800/60 hover:bg-gray-800/80 active:scale-95 transition-all duration-200"
            style={{ pointerEvents: 'auto', touchAction: 'auto', cursor: 'pointer' }}
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}