import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  LogOut, 
  Car, 
  ChevronRight, 
  ChevronLeft,
  Route,
  Wallet
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import SignInModal from './SignInModal';

export default function AppMenu({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col h-screen">
      {/* Header - Fixed height */}
      <header className="h-14 px-4 flex items-center border-b border-border/40">
        <button 
          onClick={onClose}
          className="p-2 -ml-2 hover:bg-accent/10 rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-medium ml-2">Menu</h2>
      </header>

      {/* Main Content - Flex grow with no scroll */}
      <div className="flex-1 flex flex-col justify-between py-4">
        {/* Top Section */}
        <div>
          {/* Profile/Sign In */}
          {!loading && (
            <div className="px-4 mb-4">
              {user ? (
                <div className="flex items-center gap-3">
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
                      {user.phoneNumber || '+85254491874'}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              ) : (
                <button
                  onClick={() => setShowSignInModal(true)}
                  className="w-full bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium"
                >
                  Sign In
                </button>
              )}
            </div>
          )}

          {/* Quick Actions */}
          {user && (
            <div className="px-4 space-y-2">
              <button className="flex items-center justify-between w-full py-2 hover:bg-accent/10 rounded-lg px-3">
                <div className="flex items-center gap-3">
                  <Route className="w-5 h-5" />
                  <span className="font-medium">Trips</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
              <button className="flex items-center justify-between w-full py-2 hover:bg-accent/10 rounded-lg px-3">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5" />
                  <span className="font-medium">Fare Payments</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Middle Section - Featured */}
        <div className="px-4 space-y-3">
          <button 
            onClick={handleDiscoverClick}
            className="flex items-center gap-3 w-full p-3 hover:bg-accent/10 rounded-lg"
          >
            <Image
              src="/brand/discover.gif"
              alt="Discover"
              width={48}
              height={48}
              className="rounded"
              priority
            />
            <div className="flex-1 text-left">
              <h3 className="font-medium">Discover</h3>
              <p className="text-sm text-muted-foreground">Research & Tech</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          <button className="flex items-center gap-3 w-full p-3 hover:bg-accent/10 rounded-lg">
            <div className="w-12 h-12 rounded-lg bg-card flex items-center justify-center">
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
        <div className="px-4 mt-4">
          {user && (
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 text-destructive hover:text-destructive/80 mb-4"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground">
                Legal
              </Link>
            </div>
            <span className="text-sm text-muted-foreground">v4.40.1</span>
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
