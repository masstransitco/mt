import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  LogOut, 
  Car, 
  Zap, 
  ChevronRight, 
  ChevronLeft
} from 'lucide-react';
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
      {/* Header */}
      <header className="bg-background">
        <div className="flex items-center h-14 px-4">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 hover:bg-accent/10 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-medium ml-2">Menu</h2>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile/Sign In Section */}
        {!loading && (
          <div className="px-4 py-3 border-y border-border/40">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-card flex-shrink-0">
                  <Image
                    src="/brand/profile.png"
                    alt="Profile"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-lg truncate">
                        {user.phoneNumber || '+85254491874'}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.phoneNumber || '+85254491874'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSignInModal(true)}
                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        )}

        {/* Menu Items */}
        <nav className="py-1">
          {/* Quick Actions */}
          {user && (
            <>
              <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/10 transition-colors">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5" />
                  <span className="font-medium">Trips</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>

              <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/10 transition-colors">
                <div className="flex items-center gap-3">
                  <Car className="w-5 h-5" />
                  <span className="font-medium">Fare Payments</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </>
          )}

          {/* Featured Sections */}
          <div className="mt-4">
            <button 
              onClick={handleDiscoverClick}
              className="flex items-center gap-4 w-full px-4 py-3 hover:bg-accent/10 transition-colors"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-card">
                <Image
                  src="/brand/discover.gif"
                  alt="Discover"
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium">Discover</h3>
                <p className="text-sm text-muted-foreground">
                  Our Research, Technologies and Products
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </button>

            <button className="flex items-center gap-4 w-full px-4 py-3 hover:bg-accent/10 transition-colors">
              <div className="w-14 h-14 rounded-lg bg-card flex items-center justify-center">
                <Car className="w-8 h-8" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium">Commute With Us</h3>
                <p className="text-sm text-muted-foreground">
                  Transit anywhere across Hong Kong's largest EV network
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </button>
          </div>
        </nav>
      </div>

      {/* Footer */}
      <footer className="mt-auto bg-background border-t border-border/40">
        <div className="px-4 py-3">
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
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Legal
              </Link>
            </div>
            <span className="text-sm text-muted-foreground">
              v4.40.1
            </span>
          </div>
        </div>
      </footer>

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  );
}
