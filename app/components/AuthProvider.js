'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { getGuestWatchlist, clearGuestWatchlist } from '../../lib/guestWatchlist';

const AuthContext = createContext({ user: null, isLoaded: false, isSignedIn: false });

// A signed-in-only reader, so a guest's session-scoped watchlist would otherwise
// vanish the moment they create an account (the page switches to the server
// watchlist, which starts empty). Push it into their new account once, on the
// SIGNED_IN transition, then drop the guest copy so it can't double-apply.
async function migrateGuestWatchlist() {
  const tickers = getGuestWatchlist();
  if (tickers.length === 0) return;
  await Promise.all(tickers.map(ticker =>
    fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    }).catch(() => {})
  ));
  clearGuestWatchlist();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setIsLoaded(true);
      if (event === 'SIGNED_IN') migrateGuestWatchlist();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoaded, isSignedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  return useContext(AuthContext);
}
