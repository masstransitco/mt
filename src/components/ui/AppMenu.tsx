'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LogOut,
  ChevronRight,
  Route,
  Wallet,
  X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut, User } from 'firebase/auth';
import { motion } from 'framer-motion';
import { fetchHKWeather, WeatherData } from '@/lib/weather';

// License Icon SVG Component
const LicenseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15Z" clipRule="evenodd" />
  </svg>
);

interface AppMenuProps {
  onClose: () => void; // We'll call this to close the SideSheet
  onOpenWallet: () => void; // Open wallet modal from parent component
  onOpenSignIn: () => void; // Open sign in modal from parent component
  onOpenLicense: () => void; // Open license modal from parent component
}

export default function AppMenu({ 
  onClose, 
  onOpenWallet, 
  onOpenSignIn, 
  onOpenLicense 
}: AppMenuProps) {
  const [user, setUser] = useState<User | null>(null);
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

  // Updated handlers to use parent component functions
  const handleWalletClick = () => {
    if (!user) {
      onOpenSignIn();
    } else {
      onOpenWallet();
    }
    // Close side menu when opening a modal
    onClose();
  };

  const handleLicenseClick = () => {
    if (!user) {
      onOpenSignIn();
    } else {
      onOpenLicense();
    }
    // Close side menu when opening a modal
    onClose();
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full flex flex-col bg-black text-white"
    >
      {/* Header */}
      <header className="h-16 border-b border-gray-800 flex items-center justify-between px-4">
        <h2 className="text-base font-medium text-white">
          Menu
        </h2>

        {/* Close Button (X) calls onClose */}
        <button
          onClick={onClose}
          className="flex items-center justify-center p-2 rounded-full hover:bg-gray-800 transition-colors duration-200"
          aria-label="Close menu"
        >
          <X className="w-5 h-5 text-gray-300" />
        </button>
      </header>

      {/* Weather Section */}
      {weather && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm px-4 py-4"
        >
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <i className={`wi ${getWeatherIconClass(weather.weathercode)} text-xl text-zinc-200`} />
            <span className="text-zinc-200 font-medium">
              {Math.round(weather.temperature)}°C
            </span>

            <span className="opacity-50">|</span>
            <div className="flex items-center gap-1">
              <i className="wi wi-strong-wind text-zinc-200" />
              <span>{Math.round(weather.windspeed)} km/h</span>
            </div>

            {typeof weather.rainChance === 'number' && (
              <>
                <span className="opacity-50">|</span>
                <div className="flex items-center gap-1">
                  <i className="wi wi-raindrops text-zinc-200" />
                  <span>{weather.rainChance}%</span>
                </div>
              </>
            )}

            {typeof weather.aqi === 'number' && (
              <>
                <span className="opacity-50">|</span>
                <div className="flex items-center gap-1">
                  <span className="bg-zinc-800 px-2 py-0.5 rounded text-xs text-zinc-200">
                    AQI
                  </span>
                  <span>{weather.aqi}</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content (scrollable) */}
      <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {/* User Profile / Sign In */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 py-5 border-b border-gray-800"
        >
          {!loading && (
            <div className="mb-4">
              {user ? (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    // open user profile or settings if needed
                  }}
                  className="w-full flex items-center gap-3 bg-gray-800/70 hover:bg-gray-700 rounded-lg px-4 py-3.5 text-left transition-colors duration-200"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border border-gray-600">
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
                    <h3 className="font-medium text-white truncate">
                      {user.phoneNumber || '+852 *********'}
                    </h3>
                    <p className="text-sm text-gray-300 truncate">
                      {user.email || user.phoneNumber || 'User'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    onOpenSignIn();
                    onClose();
                  }}
                  className="w-3/5 mx-auto bg-blue-600 text-white px-5 py-3 rounded-lg font-medium transition-colors duration-200 hover:bg-blue-700 active:bg-blue-800"
                >
                  Sign In
                </motion.button>
              )}
            </div>
          )}

          {/* Quick Actions (for signed-in users) */}
          {user && (
            <div className="space-y-2">
              <motion.button
                whileHover={{ x: 2 }}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-800 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full bg-blue-600/20">
                    <Route className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-medium text-gray-200">Trips</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </motion.button>

              <motion.button
                whileHover={{ x: 2 }}
                onClick={handleWalletClick}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-800 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full bg-blue-600/20">
                    <Wallet className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="font-medium text-gray-200">Wallet</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </motion.button>
              
              {/* License Button */}
              <motion.button
                whileHover={{ x: 2 }}
                onClick={handleLicenseClick}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-800 transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full bg-blue-600/20">
                    <LicenseIcon />
                  </div>
                  <span className="font-medium text-gray-200">License & ID</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Middle Section - Featured (Discover only) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-4 space-y-3 py-5 border-b border-gray-800"
        >
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleDiscoverClick}
            className="w-full flex items-center gap-3 rounded-lg p-3 hover:bg-gray-800 transition-colors duration-200"
          >
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700">
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
              <h3 className="font-medium text-white">Discover</h3>
              <p className="text-sm text-gray-400">Research & Tech</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </motion.button>
        </motion.div>

        {/* Bottom Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="px-4 py-8 mt-auto"
        >
          {user && (
            <motion.button
              whileHover={{ x: 2, color: '#ef4444' }}
              onClick={handleSignOut}
              className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors duration-200 mb-6"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </motion.button>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Link
                href="/privacy"
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-200"
              >
                Privacy
              </Link>
              <Link
                href="/legal"
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-200"
              >
                Legal
              </Link>
            </div>
            <span className="text-sm text-gray-600">v4.40.1</span>
          </div>
        </motion.div>
      </div>

      {/* Modals are now rendered at the Page level, not here */}
    </motion.div>
  );
}
