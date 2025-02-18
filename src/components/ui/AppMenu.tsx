'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  LogOut,
  Car,
  ChevronRight,
  Route,
  Wallet,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';

// Lazy-loaded modals
const SignInModal = dynamic(() => import('./SignInModal'), { ssr: false });
const WalletModal = dynamic(() => import('./WalletModal'), { ssr: false });

import { fetchHKWeather, WeatherData } from '@/lib/weather';

interface AppMenuProps {
  onClose: () => void; // We'll call this to close the SideSheet
}

export default function AppMenu({ onClose }: AppMenuProps) {
  const [user, setUser] = useState<User | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Weather data
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch HK Weather
    async function getWeather() {
      const data = await fetchHKWeather();
      setWeather(data);
    }
    getWeather();
  }, []);

  // If user signs out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onClose(); // close SideSheet afterwards
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // External link for "Discover"
  const handleDiscoverClick = () => {
    window.open('https://home-nine-indol.vercel.app', '_blank');
  };

  // Wallet logic
  const handleWalletClick = () => {
    if (!user) {
      setShowSignInModal(true);
    } else {
      setShowWalletModal(true);
    }
  };

  // Weather Icons mapping
  const getWeatherIconClass = (weatherCode: number): string => {
    if (weatherCode === 0) return 'wi-day-sunny';
    if (weatherCode >= 1 && weatherCode <= 3) return 'wi-day-cloudy';
    if (weatherCode >= 80 && weatherCode <= 82) return 'wi-day-rain';
    if (weatherCode >= 95 && weatherCode <= 99) return 'wi-day-thunderstorm';
    return 'wi-cloud';
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <header
        className="
          h-14 
          border-b border-border/40 
          flex items-center 
          justify-between 
          px-4
        "
      >
        <h2
          className="
            text-base
            font-medium
            [font-family:'Helvetica Neue',Helvetica,Arial,sans-serif]
          "
        >
          Menu
        </h2>

        {/* Close Button (ChevronRight) calls onClose */}
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
      </header>

      {/* Weather Section */}
      {weather && (
        <div className="border-b border-border/40 bg-card/20 px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <i className={`wi ${getWeatherIconClass(weather.weathercode)} text-xl`} />
            <span className="text-foreground font-medium">
              {Math.round(weather.temperature)}°C
            </span>

            <span className="opacity-50">|</span>
            <div className="flex items-center gap-1">
              <i className="wi wi-strong-wind" />
              <span>{Math.round(weather.windspeed)} km/h</span>
            </div>

            {typeof weather.rainChance === 'number' && (
              <>
                <span className="opacity-50">|</span>
                <div className="flex items-center gap-1">
                  <i className="wi wi-raindrops" />
                  <span>{weather.rainChance}%</span>
                </div>
              </>
            )}

            {typeof weather.aqi === 'number' && (
              <>
                <span className="opacity-50">|</span>
                <div className="flex items-center gap-1">
                  <i className="wi wi-smoke" />
                  <span>{weather.aqi}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content (scrollable) */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* User Profile / Sign In */}
        <div className="px-4 py-4 border-b border-border/40">
          {!loading && (
            <div className="mb-4">
              {user ? (
                <button
                  onClick={() => {
                    // open user profile or settings if needed
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

          {/* Quick Actions (for signed-in users) */}
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

      {/* Lazy-loaded Modals */}
      <SignInModal
        isOpen={showSignInModal}
        onClose={() => setShowSignInModal(false)}
      />
      <WalletModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </div>
  );
}
