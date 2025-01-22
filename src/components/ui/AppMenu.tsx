'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { LogOut, Car, Zap, ChevronRight, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import SignInModal from './signin';

export default function AppMenu() {
  const router = useRouter();
  const user = auth.currentUser;
  const [showSignInModal, setShowSignInModal] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Generate initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  // Helper to determine avatar content
  const renderAvatar = () => {
    if (!user) {
      return (
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
          <User className="w-6 h-6 text-primary-foreground" />
        </div>
      );
    }

    if (user.photoURL) {
      return (
        <Image
          src={user.photoURL}
          alt="User Profile"
          width={48}
          height={48}
          className="rounded-full object-cover"
        />
      );
    }

    return (
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
        {getInitials(user.displayName || user.email?.split('@')[0] || 'U')}
      </div>
    );
  };

  return (
    <nav className="w-80 min-h-screen bg-background border-r border-border px-4 pb-4">
      {/* Header */}
      <h2 className="text-xl font-medium py-2">Menu</h2>

      {/* Profile Section */}
      <div className="flex items-center gap-3 my-4">
        <div className="w-12 h-12 rounded-full overflow-hidden">
          {renderAvatar()}
        </div>
        <div className="flex flex-col">
          {user ? (
            <>
              <span className="font-semibold">
                {user.displayName || user.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            </>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setShowSignInModal(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm w-full"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items - Only show if user is signed in */}
      {user && (
        <ul className="space-y-4">
          <li>
            <button className="flex items-center justify-between w-full text-left hover:bg-accent/10 p-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4" />
                <span>Charging</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </li>
          <li>
            <button className="flex items-center justify-between w-full text-left hover:bg-accent/10 p-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Car className="w-4 h-4" />
                <span>My Products</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </li>
        </ul>
      )}

      {/* Brand Animation */}
      <div className="my-6">
        <Image
          src="/brand/drive.gif"
          alt="Drive Animation"
          width={200}
          height={100}
          className="w-full object-contain"
        />
      </div>

      {/* Discover Section */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Discover</h3>
        <p className="text-xs text-muted-foreground">
          Products, Accessories and Tesla Insurance
        </p>
      </div>

      <div className="mt-4 space-y-1">
        <h3 className="text-sm font-semibold">Charge Your Other EV</h3>
        <p className="text-xs text-muted-foreground">
          Charge on the Largest Global Network
        </p>
      </div>

      {/* Sign Out Button - Only show if user is signed in */}
      {user && (
        <div className="mt-4">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Footer Section */}
      <div className="border-t border-border mt-6 pt-4 text-sm space-y-2">
        <p className="text-muted-foreground">
          App Version <span className="text-foreground">v4.40.1-3113</span>
        </p>
        <div className="flex gap-4 text-muted-foreground">
          <button className="hover:text-foreground">Privacy</button>
          <button className="hover:text-foreground">Legal</button>
          <button className="hover:text-foreground">Acknowledgements</button>
        </div>
      </div>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </nav>
  );
}
