'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LogOut,
  Car,
  ChevronRight,
  Route,
  Wallet,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';
import SignInModal from './SignInModal';
import WalletModal from './WalletModal';

// Import weather fetching function + types
import { fetchHKWeather, WeatherData } from '@/lib/weather';

export default function AppMenu({ onClose }: { onClose: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // State for weather
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Listen for auth state changes (Firebase)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch HK Weather on component mount
  useEffect(() => {
    async function getWeather() {
      const data = await fetchHKWeather();
      setWeather(data);
    }
    getWeather();
  }, []);

  // Sign out user
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Open external link for "Discover"
  const handleDiscoverClick = () => {
    window.open('https://home-nine-indol.vercel.app', '_blank');
  };

  // Handle wallet logic
  const handleWalletClick = () => {
    if (!user) {
      setShowSignInModal(true);
      return;
    }
    setShowWalletModal(true);
  };

  // Weather code -> Weather Icons mapping
  const getWeatherIconClass = (weatherCode: number): string => {
    if (weatherCode === 0) {
      // Clear sky
      return 'wi-day-sunny';
    } else if (weatherCode >= 1 && weatherCode <= 3) {
      // Mainly clear to overcast
      return 'wi-day-cloudy';
    } else if (weatherCode >= 80 && weatherCode <= 82) {
      // Rain showers
      return 'wi-day-rain';
    } else if (weatherCode >= 95 && weatherCode <= 99) {
      // Thunderstorm
      return 'wi-day-thunderstorm';
    }
    // Default
    return 'wi-cloud';
  };

  return (
    <div
      // Disable scrolling by using overflow-hidden on the outer container
      className="
        fixed inset-0 z-50 
        flex flex-col 
        bg-background
        shadow-md
        h-[100dvh] 
        pb-safe 
        overflow-hidden
      "
    >
      {/* Header */}
      <header
        // Use grid with 3 columns so weather is left, title is centered, close button is right
        className="
          safe-top 
          h-14 
          border-b border-border/40 
          grid grid-cols-3 
          items-center 
          px-4
        "
      >
        {/* Weather Display (left) */}
        <div className="flex items-center gap-2">
          {weather && (
            <>
              <i
                className={`wi ${getWeatherIconClass(weather.weathercode)} text-xl`}
              ></i>
              <span className="text-sm font-medium">
                {Math.round(weather.temperature)}°C
              </span>
            </>
          )}
        </div>

        {/* Title (center) */}
        <h2
          className="
            text-base 
            font-medium 
            text-center 
            col-span-1
            [font-family:'Helvetica Neue',Helvetica,Arial,sans-serif]
          "
        >
          Menu
        </h2>

        {/* Close Button (right) */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="
              flex items-center justify-center 
              p-2 
              rounded-full
              hover:bg-accent/10 
              transition-colors 
              duration-200
            "
            aria-label="Close menu"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content (Non-scrollable now) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top Section (User Profile / Sign In) */}
        <div className="px-4 py-4 border-b border-border/40">
          {!loading && (
            <div className="mb-4">
              {user ? (
                <button
                  onClick={() => {
                    // Potentially open user profile or settings
                  }}
                  className="
                    w-full 
                    flex items-center gap-3 
                    bg-card/20 
                    hover:bg-card/30 
                    rounded-lg 
                    px-3 py-3
                    text-left
                    transition-colors
                    duration-200
                  "
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-card flex-shrink-0">
                    <Image
                      src="/brand/profile.png"
                      alt="Profile"
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      priority
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {user.phoneNumber || '+85254491874'}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email || user.phoneNumber || 'User'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSignInModal(true)}
                  className="
                    w-full 
                    bg-primary 
                    text-primary-foreground 
                    px-6 py-3.5 
                    rounded-lg 
                    font-medium 
                    transition-colors
                    duration-200
                    hover:opacity-90
                    active:opacity-80
                  "
                >
                  Sign In
                </button>
              )}
            </div>
          )}

          {/* Quick Actions (visible if user is signed in) */}
          {user && (
            <div className="space-y-2">
              <button
                className="
                  w-full 
                  flex items-center justify-between 
                  py-2 px-3 
                  rounded-lg 
                  hover:bg-accent/10 
                  transition-colors 
                  duration-200
                "
              >
                <div className="flex items-center gap-3">
                  <Route className="w-5 h-5" />
                  <span className="font-medium">Trips</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>

              <button
                onClick={handleWalletClick}
                className="
                  w-full 
                  flex items-center justify-between 
                  py-2 px-3 
                  rounded-lg 
                  hover:bg-accent/10 
                  transition-colors 
                  duration-200
                "
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">Wallet</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Middle Section - Featured */}
        <div className="px-4 space-y-3 py-4 border-b border-border/40">
          <button
            onClick={handleDiscoverClick}
            className="
              w-full 
              flex items-center gap-3 
              rounded-lg 
              p-3
              hover:bg-accent/10 
              transition-colors 
              duration-200
            "
          >
            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
              <Image
                src="/brand/discover.gif"
                alt="Discover"
                width={48}
                height={48}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium">Discover</h3>
              <p className="text-sm text-muted-foreground">Research & Tech</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button
            className="
              w-full
              flex items-center gap-3
              rounded-lg
              p-3
              hover:bg-accent/10
              transition-colors
              duration-200
            "
          >
            <div className="w-12 h-12 rounded-lg bg-card flex items-center justify-center flex-shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium">Commute With Us</h3>
              <p className="text-sm text-muted-foreground">EV Transit Network</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Bottom Section */}
        <div className="px-4 py-8 mt-auto">
          {user && (
            <button
              onClick={handleSignOut}
              className="
                flex items-center gap-2 
                text-destructive 
                hover:text-destructive/80 
                transition-colors 
                duration-200 
                mb-4
              "
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Link
                href="/privacy"
                className="
                  text-sm 
                  text-muted-foreground 
                  hover:text-foreground 
                  transition-colors 
                  duration-200
                "
              >
                Privacy
              </Link>
              <Link
                href="/legal"
                className="
                  text-sm 
                  text-muted-foreground 
                  hover:text-foreground 
                  transition-colors 
                  duration-200
                "
              >
                Legal
              </Link>
            </div>
            <span className="text-sm text-muted-foreground">v4.40.1</span>
          </div>
        </div>
      </div>

      {/* Sign In Modal */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />

      {/* Wallet Modal */}
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </div>
  );
}