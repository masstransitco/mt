'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Car, Zap, ChevronRight, User, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import SignInModal from './signin';

export default function AppMenu({ onClose }: { onClose: () => void }) {
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

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border">
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

      <div className="flex flex-col min-h-[calc(100vh-64px)]">
        {/* Main Content */}
        <div className="flex-1">
          {/* Profile Section */}
          {user && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt="Profile"
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                      {getInitials(user.displayName || user.email?.split('@')[0] || 'U')}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium">
                    {user.displayName || user.email?.split('@')[0]}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          {!user && (
            <div className="p-4 border-b border-border">
              <button
                onClick={() => setShowSignInModal(true)}
                className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-lg text-sm font-medium"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Menu Items */}
          <nav className="p-4 space-y-2">
            <button 
              onClick={handleDiscoverClick}
              className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10"
            >
              <span className="text-sm font-medium">Discover</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>

            {user && (
              <>
                <button className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10">
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4" />
                    <span className="text-sm font-medium">Charging</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>

                <button className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent/10">
                  <div className="flex items-center gap-3">
                    <Car className="w-4 h-4" />
                    <span className="text-sm font-medium">My Products</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border mt-auto">
          {user && (
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 mb-4"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          )}
          
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              App Version v4.40.1-3113
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground">
                Legal
              </Link>
              <Link href="/acknowledgements" className="text-sm text-muted-foreground hover:text-foreground">
                Acknowledgements
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  );
}
