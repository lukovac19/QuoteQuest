import { useState, useEffect } from 'react';
import { QuoteQuestNavigation } from './components/QuoteQuestNavigation';
import { QuoteQuestHero } from './components/QuoteQuestHero';
import { QuoteQuestAbout } from './components/QuoteQuestAbout';
import { QuoteQuestFooter } from './components/QuoteQuestFooter';
import { SavedQuotesModal } from './components/SavedQuotesModal';
import { Toaster } from './components/ui/sonner';
import { Analytics } from '@vercel/analytics/react';
import { AuthPage } from './components/AuthPage';
import { supabase } from './lib/supabase'; // DODAJ OVO

interface SavedQuote {
  id: string;
  text: string;
  page: number;
  dateSaved: string;
}

export default function App() {
  const [isSavedQuotesOpen, setIsSavedQuotesOpen] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Provjeri da li je korisnik već ulogovan
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    // Slušaj promjene autentifikacije
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Učitaj citate iz baze kad se user uloguje
  useEffect(() => {
    if (currentUser) {
      loadSavedQuotes();
    }
  }, [currentUser]);

  const loadSavedQuotes = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('saved_quotes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedQuotes = data.map((q: any) => ({
        id: q.id,
        text: q.quote_text,
        page: q.page_number,
        dateSaved: new Date(q.created_at).toLocaleDateString('bs-BA'),
        context: q.context,
        element: q.element,
        meaning: q.meaning,
      }));
      setSavedQuotes(formattedQuotes);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    await supabase.from('saved_quotes').delete().eq('id', id);
    setSavedQuotes(savedQuotes.filter((q) => q.id !== id));
  };

  const handleDeleteAll = async () => {
    if (!currentUser) return;
    await supabase.from('saved_quotes').delete().eq('user_id', currentUser.id);
    setSavedQuotes([]);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E6F0FF] overflow-x-hidden">
      <QuoteQuestNavigation
        onOpenSavedQuotes={() => {
          loadSavedQuotes();
          setIsSavedQuotesOpen(true);
        }}
        onOpenAuth={() => setIsAuthOpen(true)}
        user={currentUser}
      />

      <QuoteQuestHero
        onQuoteSaved={loadSavedQuotes}
        onRequireAuth={() => setIsAuthOpen(true)}
        isAuthed={!!currentUser}
        currentUser={currentUser} // DODAJ OVO
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