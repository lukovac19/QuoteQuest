import { useState, useEffect } from 'react';
import { QuoteQuestNavigation } from './components/QuoteQuestNavigation';
import { QuoteQuestHero } from './components/QuoteQuestHero';
import { QuoteQuestAbout } from './components/QuoteQuestAbout';
import { QuoteQuestFooter } from './components/QuoteQuestFooter';
import { SavedQuotesModal } from './components/SavedQuotesModal';
import { AuthPage } from './components/AuthPage';
import { AccountModal } from './components/AccountModal';
import { Toaster } from './components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { authHelpers } from './lib/supabase';

interface SavedQuote {
  id: string;
  text: string;
  page: number;
  dateSaved: string;
  context?: string;
  element?: string;
  meaning?: string;
}

export default function App() {
  const [isSavedQuotesOpen, setIsSavedQuotesOpen] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data: authListener } = authHelpers.onAuthStateChange((user) => {
      if (user) {
        const userData = {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || 'Korisnik',
          isPremium: user.user_metadata?.isPremium || false,
        };
        setCurrentUser(userData);
        loadSavedQuotes(user.id);
      } else {
        setCurrentUser(null);
        setSavedQuotes([]);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const checkUser = async () => {
    try {
      const user = await authHelpers.getCurrentUser();
      if (user) {
        const userData = {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name || 'Korisnik',
          isPremium: user.user_metadata?.isPremium || false,
        };
        setCurrentUser(userData);
        loadSavedQuotes(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSavedQuotes = async (userId?: string) => {
    const userIdToUse = userId || currentUser?.id;
    if (!userIdToUse) return;

    try {
      const saved = localStorage.getItem(`quotes_${userIdToUse}`);
      if (saved) {
        setSavedQuotes(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
  };

  const handleLogin = () => {
    setIsAuthOpen(true);
  };

  const handleLogout = async () => {
    try {
      await authHelpers.signOut();
      setCurrentUser(null);
      setSavedQuotes([]);
      setIsAccountOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleAuthSuccess = (user: any) => {
    setCurrentUser(user);
    setIsAuthOpen(false);
    loadSavedQuotes(user.id);
  };

  const handleOpenAccount = () => {
    setIsAccountOpen(true);
  };

  const handleDeleteQuote = (id: string) => {
    const updated = savedQuotes.filter((q) => q.id !== id);
    setSavedQuotes(updated);
    if (currentUser) {
      localStorage.setItem(`quotes_${currentUser.id}`, JSON.stringify(updated));
    }
  };

  const handleDeleteAll = () => {
    setSavedQuotes([]);
    if (currentUser) {
      localStorage.removeItem(`quotes_${currentUser.id}`);
    }
  };

  const handleQuoteSaved = () => {
    if (currentUser) {
      loadSavedQuotes(currentUser.id);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-[#00D1FF] border-t-transparent" />
          <p className="text-lg text-[#E6F0FF]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Učitavanje QuoteQuest...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0A0A0A] text-[#E6F0FF]">
      <QuoteQuestNavigation
        onOpenSavedQuotes={() => {
          if (currentUser) {
            loadSavedQuotes();
          }
          setIsSavedQuotesOpen(true);
        }}
        currentUser={currentUser}
        onLogin={handleLogin}
        onOpenAccount={handleOpenAccount}
      />

      <QuoteQuestHero
        currentUser={currentUser}
        onRequireAuth={handleLogin}
        isAuthed={!!currentUser}
        onQuoteSaved={handleQuoteSaved}
      />

      <QuoteQuestAbout />
      <QuoteQuestFooter />

      <SavedQuotesModal
        open={isSavedQuotesOpen}
        onOpenChange={setIsSavedQuotesOpen}
        quotes={savedQuotes}
        onDeleteQuote={handleDeleteQuote}
        onDeleteAll={handleDeleteAll}
        isMobile={isMobile}
      />

      <AuthPage
        open={isAuthOpen}
        onOpenChange={setIsAuthOpen}
        onSuccess={(user) => setCurrentUser(user)}
      />

      <AccountModal
        open={isAccountOpen}
        onOpenChange={setIsAccountOpen}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#001F54',
            border: '1px solid rgba(0, 209, 255, 0.3)',
            color: '#E6F0FF',
          },
        }}
      />

      <Analytics />
    </div>
  );
}
