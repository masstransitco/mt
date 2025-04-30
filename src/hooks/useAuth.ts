import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { User as FirebaseUser, onIdTokenChanged } from 'firebase/auth';

interface CustomUser extends FirebaseUser {
  isAdmin?: boolean;
  role?: string;
}

export function useAuth() {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        // Get the ID token with fresh claims
        const token = await firebaseUser.getIdTokenResult();
        const customUser: CustomUser = {
          ...firebaseUser,
          role: token.claims.role as string || 'user',
          isAdmin: token.claims.role === 'admin',
        };
        setUser(customUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  return { user, loading, isAdmin: user?.isAdmin };
}