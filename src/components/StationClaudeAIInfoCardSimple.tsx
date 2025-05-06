"use client";

/**
 * StationClaudeAIInfoCardSimple
 * 
 * The primary Claude AI info card component used in the StationSelector.
 * This component provides AI-generated information about stations including:
 * - Weather data
 * - Traffic information
 * - Dining options
 * - Shopping and retail
 * - Cultural information
 * - Environmental data
 * - Transport options
 * - Nearby places
 * - Safety information
 * 
 * Features:
 * - Expandable card UI with portal-based modal
 * - Multi-language support
 * - Integration with weather API
 * - Tab-based interface for different information categories
 * 
 * Note: This is the standalone version without Redux integration, making it
 * more modular and easier to use across the application.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Minimize2, X, Maximize2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { StationFeature } from "@/store/stationsSlice";
import StationClaudeInfoCardSimple from "./StationClaudeInfoCardSimple";

const CLAUDE_INFO_PORTAL_ID = "station-claude-info-portal-simple";

// Top 10 languages in Hong Kong (residents, migrants, tourists)
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'zh-TW', label: 'Traditional Chinese', nativeName: '繁體中文' },
  { code: 'zh-CN', label: 'Simplified Chinese', nativeName: '简体中文' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
  { code: 'tl', label: 'Tagalog', nativeName: 'Tagalog' },
  { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'th', label: 'Thai', nativeName: 'ไทย' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
];

interface StationClaudeAIInfoCardSimpleProps {
  station: StationFeature;
  expanded?: boolean;
  onToggleExpanded?: (newVal: boolean) => void;
  hideDefaultExpandButton?: boolean;
  className?: string;
}

const StationClaudeAIInfoCardSimple: React.FC<StationClaudeAIInfoCardSimpleProps> = ({
  station,
  expanded: externalExpanded,
  onToggleExpanded,
  hideDefaultExpandButton = false,
  className,
}) => {
  // Local expansion state
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = typeof externalExpanded === "boolean" ? externalExpanded : localExpanded;
  
  // Language state
  const [language, setLanguage] = useState<string>('en');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Portal container reference
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Reference for the dropdown menu
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Keep local expansion in sync with external
  useEffect(() => {
    if (typeof externalExpanded === "boolean") {
      setLocalExpanded(externalExpanded);
    }
  }, [externalExpanded]);
  
  // Create a dedicated portal container if needed
  useEffect(() => {
    let container = document.getElementById(CLAUDE_INFO_PORTAL_ID) as HTMLDivElement | null;
    if (!container) {
      container = document.createElement("div");
      container.id = CLAUDE_INFO_PORTAL_ID;
      container.style.position = "fixed";
      container.style.left = "0";
      container.style.top = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.zIndex = "9999";
      container.style.pointerEvents = "none";
      document.body.appendChild(container);
    }
    portalContainerRef.current = container;
  }, []);
  
  // Expand/collapse logic
  const toggleExpanded = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      
      if (onToggleExpanded) {
        onToggleExpanded(!isExpanded);
      } else {
        setLocalExpanded(!isExpanded);
      }
    },
    [isExpanded, onToggleExpanded]
  );
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        toggleExpanded();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded, toggleExpanded]);
  
  // Simple language selection handler
  const handleLanguageChange = (langCode: string) => {
    console.log('Language changed to:', langCode);
    
    // Close dropdown immediately
    setDropdownOpen(false);
    
    // Only update if language has actually changed
    if (langCode !== language) {
      setLanguage(langCode);
    }
  };

  // Get current language display name
  const getCurrentLanguageLabel = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === language);
    return lang ? lang.nativeName : 'English';
  };
  
  // The main card structure
  const aiInfoCard = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto bg-black",
        !isExpanded && "h-52",
        className
      )}
      style={
        isExpanded
          ? {
              position: "fixed",
              zIndex: 99999,
              left: "5%",
              right: "5%",
              top: "5%",
              bottom: "5%",
              width: "90%",
              height: "90%",
              margin: "0 auto",
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Card content */}
      <div className="absolute inset-0 flex flex-col">
        {/* Title bar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-900">
          <div className="flex items-center space-x-3">
            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
              Claude
            </span>
            
            {/* Language Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                <Globe className="w-3 h-3 mr-1" />
                <span>{getCurrentLanguageLabel()}</span>
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 w-48 py-1 max-h-64 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors",
                        language === lang.code ? "bg-gray-700 text-white" : "text-gray-300"
                      )}
                    >
                      <span className="block">{lang.nativeName}</span>
                      <span className="block text-[10px] text-gray-400">{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={toggleExpanded}
            className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
            aria-label={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          {isExpanded && (
            <StationClaudeInfoCardSimple 
              station={station} 
              language={language as any}
              key={`station-info-${station.id}-${language}`} // Only force remount on station or language change
            />
          )}
        </div>
      </div>
      
      {/* Preview content (only visible when not expanded) */}
      {!isExpanded && (
        <div className="absolute inset-0 p-3 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-xs bg-blue-600/20 text-blue-400 px-1 py-0.5 rounded">
                Claude
              </span>
            </div>
            {!hideDefaultExpandButton && (
              <button
                onClick={toggleExpanded}
                className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Preview content */}
          <div className="mt-2 flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Click to view Claude AI information</p>
              <p className="text-gray-500 text-xs mt-1">Weather, traffic, dining, and more</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
  
  // If expanded, put it in the portal
  if (isExpanded && portalContainerRef.current) {
    return (
      <>
        {/* Optional placeholder so layout doesn't collapse */}
        <div className={cn("h-52", className)} />
        {createPortal(
          <div
            className="fixed inset-0 bg-black/50 pointer-events-auto"
            style={{ backdropFilter: "blur(2px)", zIndex: 99998 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(e);
            }}
          >
            {aiInfoCard}
          </div>,
          portalContainerRef.current
        )}
      </>
    );
  }
  
  // Otherwise, render the small static card
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg shadow-lg border border-gray-700 pointer-events-auto bg-black",
        "h-52",
        className
      )}
    >
      <div className="p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-xs bg-blue-600/20 text-blue-400 px-1 py-0.5 rounded">
            Claude
          </span>
        </div>

        {!hideDefaultExpandButton && (
          <button
            onClick={toggleExpanded}
            className="ml-2 bg-gray-800/80 p-1.5 rounded-full text-white hover:bg-gray-700/80 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StationClaudeAIInfoCardSimple;