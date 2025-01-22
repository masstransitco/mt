'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Car, Zap, ChevronRight, ChevronLeft, Settings, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import SignInModal from './SignInModal';

export default function AppMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const handleDiscoverClick = () => {
    window.open('https://home-nine-indol.vercel.app', '_blank');
  };

  const menuItems = [
    {
      title: 'Discover',
      onClick: handleDiscoverClick,
      icon: null,
      requiresAuth: false
    },
    {
      title: 'My Bookings',
      onClick: () => {},
      icon: Car,
      requiresAuth: true
    },
    {
      title: 'Charging Stations',
      onClick: () => {},
      icon: Zap,
      requiresAuth: true
    },
    {
      title: 'Notifications',
      onClick: () => {},
      icon: Bell,
      requiresAuth: true
    },
    {
      title: 'Settings',
      onClick: () => {},
      icon: Settings,
      requiresAuth: true
    }
  ];

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-border">
        <button 
          onClick={onClose}
          className="p-2 hover:bg-accent/10 rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-medium ml-2">Menu</h2>
      </div>

      {/* Main Content - Scrollable if needed */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile/Sign In Section */}
        {!loading && (
          <div className="p-4 border-b border-border">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt="Profile"
                      width={48}
                      height={48}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium">
                      {getInitials(user.displayName || user.email?.split('@')[0] || 'U')}
                    </span>
                  )}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-medium truncate">
                    {user.displayName || user.email?.split('@')[0]}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSignInModal(true)}
                className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        )}

        {/* Menu Items */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item, index) => (
            (item.requiresAuth === false || user) && (
              <button
                key={index}
                onClick={item.onClick}
                className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  {item.icon && <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            )
          ))}
        </nav>
      </div>

      {/* Footer - Always visible */}
      <div className="p-4 border-t border-border">
        {user && (
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 mb-4 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/legal" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Legal
            </Link>
          </div>
          <span className="text-xs text-muted-foreground">
            v4.40.1
          </span>
        </div>
      </div>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  );
}
