import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { User, onIdTokenChanged } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        // Get the ID token with fresh claims
        const token = await user.getIdTokenResult();
        const userData = {
          ...user,
          role: token.claims.role || 'user',
          isAdmin: token.claims.role === 'admin',
        };
        setUser(userData as any);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  return { user, loading, isAdmin: user?.isAdmin };
}