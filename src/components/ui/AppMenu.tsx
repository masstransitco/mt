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

  const handleDiscoverClick = () => {
    window.open('https://home-nine-indol.vercel.app', '_blank');
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col min-h-screen w-full">
      {/* Safe Area Top Spacing for Mobile */}
      <div className="h-safe-area-top bg-background" />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center px-4 py-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-accent/10 rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-medium ml-2">Menu</h2>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile/Sign In Section */}
        {!loading && (
          <div className="p-4 border-b border-border">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-primary flex-shrink-0">
                  <Image
                    src="/brand/profile.png"
                    alt="Profile"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-medium truncate">
                    {user.displayName || user.phoneNumber || 'User'}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.phoneNumber || 'No phone number'}
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
          <button 
            onClick={handleDiscoverClick}
            className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0">
                <Image
                  src="/brand/discover.gif"
                  alt="Discover"
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <span className="text-sm font-medium">Discover</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {user && (
            <>
              <button className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  <span className="text-sm font-medium">Charging</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              </button>

              <button className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <Car className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  <span className="text-sm font-medium">My Products</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Footer - Sticky to bottom */}
      <div className="sticky bottom-0 bg-background border-t border-border">
        <div className="p-4">
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

        {/* Safe Area Bottom Spacing for Mobile */}
        <div className="h-safe-area-bottom bg-background" />
      </div>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  );
}
