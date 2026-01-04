import { useState, useEffect } from 'react';
import { QuoteQuestNavigation } from './components/QuoteQuestNavigation';
import { QuoteQuestHero } from './components/QuoteQuestHero';
import { QuoteQuestAbout } from './components/QuoteQuestAbout';
import QuoteQuestFooter from './components/QuoteQuestFooter';
import { SavedQuotesModal } from './components/SavedQuotesModal';
import { Toaster } from './components/ui/sonner';
import { Analytics } from "@vercel/analytics/react";  // ← DODAJ OVO

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

  useEffect(() => {
    loadSavedQuotes();

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadSavedQuotes = () => {
    const quotes = JSON.parse(localStorage.getItem('savedQuotes') || '[]');
    setSavedQuotes(quotes);
  };

  const handleDeleteQuote = (id: string) => {
    const filtered = savedQuotes.filter((q) => q.id !== id);
    localStorage.setItem('savedQuotes', JSON.stringify(filtered));
    setSavedQuotes(filtered);
  };

  const handleDeleteAll = () => {
    localStorage.setItem('savedQuotes', '[]');
    setSavedQuotes([]);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E6F0FF] overflow-x-hidden">
      <QuoteQuestNavigation
        onOpenSavedQuotes={() => {
          loadSavedQuotes();
          setIsSavedQuotesOpen(true);
        }}
      />

      <QuoteQuestHero onQuoteSaved={loadSavedQuotes} />

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

      <Analytics />  {/* ← DODAJ OVO */}
    </div>
  );
}