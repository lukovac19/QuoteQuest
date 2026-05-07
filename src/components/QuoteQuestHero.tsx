import {
  Upload,
  Send,
  Bookmark,
  BookmarkCheck,
  Loader2,
  RotateCcw,
  Plus,
  Minus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { toast } from 'sonner@2.0.3';
import { supabase } from '../lib/supabase';

function getApiBase(): string {
  // Lokalno (npm run dev ili vite preview na localhostu): uvijek /api → Vite proxy, bez CORS-a.
  // Samo na pravom deployu (npr. Vercel) koristimo puni URL iz env-a.
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') {
      return '/api';
    }
  } else if (import.meta.env.DEV) {
    return '/api';
  }

  const url = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  if (!url) {
    console.warn('VITE_API_URL nije postavljen; API pozivi neće raditi u produkciji.');
    return '';
  }
  return url;
}

interface Quote {
  id: string;
  text: string;
  page: number;
  isBookmarked: boolean;
  expandedContext?: boolean;
  context?: string;
  element?: string | null;
  meaning?: string | null;
}

interface CountMeta {
  word: string | null;
  total: number;
  perPage: { page: number; count: number }[];
}

type ResultType =
  | 'none'
  | 'quotes'
  | 'characterization'
  | 'theme'
  | 'idea'
  | 'theme-idea'
  | 'symbolism'
  | 'motif'
  | 'relation'
  | 'events'
  | 'count'
  | 'micro-detail'
  | 'contrast'
  | 'summary';

interface QuoteQuestHeroProps {
  onQuoteSaved: () => void;
  onRequireAuth: () => void;
  isAuthed: boolean;
  currentUser: any;
}

const PLACEHOLDER_EXAMPLES = [
  'Na kojim stranicama se spominje motiv sunca?',
  'Kako je opisana Ana Karenjina u prvom poglavlju?',
  'Koji su ključni citati o slobodi?',
  'Šta je simbol ptice u knjizi?',
  'Koje boje je haljina Nore?',
  'Koji kontrasti postoje između likova?'
];

const SMART_SUGGESTIONS = [
  'Motivi',
  'Karakterizacija lika',
  'Ključni citati',
  'Tema i ideja djela',
  'Simbolika',
  'Odnosi među likovima',
  'Važni događaji',
  'Kontrasti u djelu',
  'Kratak sadržaj djela'
];

export function QuoteQuestHero({ 
  onQuoteSaved,
  onRequireAuth,
  isAuthed,
  currentUser
}: QuoteQuestHeroProps) {
  const [fileName, setFileName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState<string>('');

  const [results, setResults] = useState<Quote[]>([]);
  const [resultType, setResultType] = useState<ResultType>('none');
  const [countMeta, setCountMeta] = useState<CountMeta | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.type !== 'application/pdf') {
        toast.error('Podržan je samo PDF.');
        return;
      }
      setFile(f);
      setFileName(f.name);
      toast.success('PDF učitan uspješno!');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === 'application/pdf') {
      setFile(f);
      setFileName(f.name);
      toast.success('PDF učitan uspješno!');
    } else {
      toast.error('Podržan je samo PDF.');
    }
  };

  const resetAnalysis = () => {
    setResults([]);
    setCountMeta(null);
    setFollowUpQuestions([]);
    setResultType('none');
    setQuestion('');
    setFileName('');
    setFile(null);
    toast.info('Analiza resetovana');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuestion(suggestion);
    setShowSuggestions(false);
  };

  const handleFollowUpClick = (followUp: string) => {
    setQuestion(followUp);
  };

  const handleSubmit = async () => {
    if (!isAuthed) {
      toast.info('Prijavite se kako biste započeli analizu');
      onRequireAuth();
      return;
    }
      
    if (!file) {
      toast.error('Molimo prvo učitajte PDF.');
      return;
    }

    if (!question) {
      toast.error('Molimo unesite pitanje.');
      return;
    }

    setIsAnalyzing(true);
    setShowSuggestions(false);
    setResults([]);
    setCountMeta(null);
    setFollowUpQuestions([]);
    setResultType('none');

    // AbortController za timeout (3 minute)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('question', question);

      const apiBase = getApiBase();
      if (!apiBase) {
        clearTimeout(timeoutId);
        toast.error('API adresa nije konfigurirana.');
        return;
      }

      const response = await fetch(`${apiBase}/ask-pdf`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server greška: ${response.status}`);
      }

      const data = await response.json();

      const typeFromServer: ResultType = (data.type as ResultType) || 'quotes';
      setResultType(typeFromServer);

      if (Array.isArray(data.followUp)) {
        setFollowUpQuestions(data.followUp);
      }

      const apiQuotes = Array.isArray(data.quotes) ? data.quotes : [];

      if (apiQuotes.length === 0) {
        toast.error('AI nije pronašao rezultate za ovo pitanje.');
        setResults([]);
        setIsAnalyzing(false);
        return;
      }

      const quotes: Quote[] = apiQuotes.map((q: any) => ({
        id: q.id || `quote-${Date.now()}-${Math.random()}`,
        text: q.text || '',
        page: typeof q.page === 'number' ? q.page : 0,
        isBookmarked: false,
        expandedContext: false,
        context: q.context || '',
        element: q.element || null,
        meaning: q.meaning || null
      }));

      setResults(quotes);

      if (typeFromServer === 'count' && data.meta) {
        setCountMeta({
          word: data.meta.word || null,
          total: data.meta.total || 0,
          perPage: data.meta.perPage || []
        });
      }

      toast.success(`Pronađeno ${quotes.length} rezultata!`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("FETCH ERROR:", err);
      
      let errorMessage = 'Došlo je do greške pri analizi.';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Analiza je trajala predugo. Pokušajte sa manjim PDF-om ili jednostavnijim pitanjem.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMessage = 'Problem sa internet konekcijom. Provjerite vezu i pokušajte ponovo.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage, {
        duration: 5000
      });
      
      setResultType('none');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleBookmark = async (quoteId: string) => {
    if (!currentUser) {
      toast.error('Prijavite se da sačuvate citate');
      onRequireAuth();
      return;
    }

    setResults((prev) =>
      prev.map((quote) => {
        if (quote.id === quoteId) {
          const newState = !quote.isBookmarked;

          if (newState) {
            // Čuvaj u Supabase
            supabase
              .from('saved_quotes')
              .insert({
                user_id: currentUser.id,
                quote_text: quote.text,
                page_number: quote.page,
                context: quote.context || null,
                element: quote.element || null,
                meaning: quote.meaning || null,
              })
              .then(({ error }) => {
                if (error) {
                  console.error('Error saving quote:', error);
                  toast.error('Greška pri čuvanju citata');
                } else {
                  toast.success('Citat sačuvan!');
                  onQuoteSaved();
                }
              });
          } else {
            // Obriši iz Supabase
            supabase
              .from('saved_quotes')
              .delete()
              .eq('id', quoteId)
              .then(({ error }) => {
                if (error) {
                  console.error('Error deleting quote:', error);
                } else {
                  toast.info('Citat uklonjen');
                  onQuoteSaved();
                }
              });
          }

          return { ...quote, isBookmarked: newState };
        }
        return quote;
      })
    );
  };

  const toggleContext = (quoteId: string) => {
    setResults((prev) =>
      prev.map((quote) =>
        quote.id === quoteId
          ? { ...quote, expandedContext: !quote.expandedContext }
          : quote
      )
    );
  };

  const isCharacterizationQuestion = question
    .toLowerCase()
    .includes('karakterizacija');

  const isThemeOrIdea = resultType === 'theme' || resultType === 'idea' || resultType === 'theme-idea';
  const isSummary = resultType === 'summary';

  return (
    <section
      id="home"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] pt-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#001F54]/20 via-transparent to-transparent" />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#00D1FF]/10 blur-[100px] hero-glow"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[280px] w-[400px] rounded-full bg-[#001F54]/40 blur-[90px] opacity-60 animate-pulse-soft"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-20 lg:px-12">
        <div className="mb-16 animate-hero-in text-center">
          <h1
            className="mb-6 text-[#E6F0FF]"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: '1.1',
              letterSpacing: '-0.02em',
            }}
          >
            Analizirajte knjige uz AI
          </h1>
          <p className="animate-hero-in-delay mx-auto max-w-3xl text-lg text-[#E6F0FF]/70 md:text-xl">
            Učitajte PDF, postavite pitanje i pronađite tačne citate i stranice.
          </p>
        </div>

        <div className="animate-hero-columns mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-[#E6F0FF]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  1. Učitaj PDF
                </label>

                {fileName && (
                  <button
                    type="button"
                    onClick={resetAnalysis}
                    className="flex items-center gap-1 text-sm text-[#E6F0FF]/50 transition-all hover:text-[#00D1FF]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                />

                <label
                  htmlFor="pdf-upload"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex min-h-[120px] cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-4 transition-all ${
                    isDragOver
                      ? 'border-[#00D1FF] bg-[#001F54]/70 shadow-[0_0_20px_rgba(0,209,255,0.3)]'
                      : 'border-[#00D1FF]/30 bg-[#001F54]/40 hover:border-[#00D1FF]/60 hover:bg-[#001F54]/60'
                  }`}
                  style={{
                    boxShadow: isDragOver
                      ? '0 0 20px rgba(0,209,255,0.3)'
                      : 'inset 0 1px 0 0 rgba(255,255,255,0.03)',
                  }}
                >
                  <Upload
                    className={`h-8 w-8 transition-all ${isDragOver ? 'scale-110 text-[#00D1FF]' : 'text-[#00D1FF]'}`}
                  />

                  <div className="text-center">
                    {fileName ? (
                      <>
                        <p className="text-[#E6F0FF]">{fileName}</p>
                        <p className="text-sm text-[#00D1FF]">✓ Učitano</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[#E6F0FF]">Klikni ili prevuci PDF</p>
                        <p className="text-sm text-[#E6F0FF]/50">Maksimalno 10MB</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-3 block text-[#E6F0FF]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                2. Postavi pitanje
              </label>

              <div className="relative">
                <Textarea
                  placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  className="min-h-[150px] resize-none border-[#00D1FF]/30 bg-[#001F54]/40 text-[#E6F0FF] placeholder:text-[#E6F0FF]/40 transition-all focus-visible:border-[#00D1FF]"
                  style={{
                    boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
                  }}
                />

                {isCharacterizationQuestion && (
                  <p className="mt-2 text-xs text-[#E6F0FF]/40">
                    Tip: za karakterizaciju upiši TAČNO ime lika, npr.{' '}
                    <span className="text-[#00D1FF]">&quot;Karakterizacija lika Nora&quot;</span>
                  </p>
                )}

                {showSuggestions && question.length === 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-[#E6F0FF]/50">Prijedlozi:</p>

                    <div className="flex flex-wrap gap-2">
                      {SMART_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="rounded-full border border-[#00D1FF]/30 bg-[#001F54]/60 px-3 py-1 text-sm text-[#E6F0FF]/80 transition-all hover:border-[#00D1FF] hover:bg-[#001F54]/80 hover:shadow-[0_0_10px_rgba(0,209,255,0.2)]"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isAnalyzing}
              className="w-full rounded-xl bg-gradient-to-r from-[#00D1FF] to-[#0FB2FF] py-6 text-[#0A0A0A] transition-all hover:from-[#00D1FF]/90 hover:to-[#0FB2FF]/90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Send className="mr-2 h-5 w-5" />
              {isAnalyzing ? 'Analizira se...' : 'Počni'}
            </Button>
          </div>

          <div>
            <label className="mb-3 block text-[#E6F0FF]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              3. Rezultati
            </label>

            <div
              className="custom-scrollbar max-h-[600px] min-h-[380px] overflow-y-auto rounded-xl border border-[#00D1FF]/30 bg-[#001F54]/40 p-6"
              style={{
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
              }}
            >
              {isAnalyzing ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-[#00D1FF]" />
                  <p className="text-[#E6F0FF]/60">AI analizira tekst...</p>
                  <p className="text-center text-sm text-[#E6F0FF]/40">
                    Ovo može potrajati 1-2 minute za veće PDF-ove
                  </p>
                </div>
              ) : resultType !== 'none' && results.length > 0 ? (
                <div className="space-y-6">
                  {resultType === 'count' && countMeta && (
                    <div className="mb-4 rounded-xl border border-[#00D1FF]/30 bg-[#0A0A0A]/50 p-4">
                      <p className="mb-2 font-[Orbitron] text-sm uppercase tracking-wide text-[#9BD8FF]">
                        STATISTIKA RIJEČI
                      </p>
                      <p className="mb-1 text-[#E6F0FF]">
                        Riječ: <strong>{countMeta.word}</strong>
                      </p>
                      <p className="mb-3 text-[#E6F0FF]">
                        Ukupno: <strong>{countMeta.total} puta</strong>
                      </p>

                      {countMeta.perPage.length > 0 && (
                        <div className="mt-2">
                          <p className="mb-1 text-xs text-[#9BD8FF]">Po stranicama:</p>
                          <div className="flex flex-wrap gap-2">
                            {countMeta.perPage.slice(0, 10).map((p, i) => (
                              <span
                                key={i}
                                className="rounded border border-[#00D1FF]/30 bg-[#00D1FF]/10 px-2 py-1 text-xs text-[#00D1FF]"
                              >
                                Str. {p.page}: {p.count}×
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {results.map((quote, index) => (
                    <div
                      key={quote.id}
                      className="relative space-y-3"
                      style={{
                        animation: `fadeIn 0.5s ease-in ${index * 0.1}s both`
                      }}
                    >
                      <div className="group relative rounded-xl border border-[#00D1FF]/20 bg-[#0A0A0A]/50 p-4 transition-all hover:border-[#00D1FF]/40">
                        {quote.page > 0 && !isThemeOrIdea && !isSummary && (
                          <button
                            type="button"
                            onClick={() => toggleBookmark(quote.id)}
                            className={`absolute right-3 top-3 rounded-lg p-2 transition-all duration-300 ${
                              quote.isBookmarked
                                ? 'bg-[#00D1FF]/10 text-[#00D1FF]'
                                : 'text-[#E6F0FF]/40 hover:bg-[#00D1FF]/10 hover:text-[#00D1FF]'
                            }`}
                            style={{
                              animation: quote.isBookmarked
                                ? 'pulse 0.5s ease-in-out'
                                : 'none'
                            }}
                          >
                            {quote.isBookmarked ? (
                              <BookmarkCheck className="w-5 h-5" />
                            ) : (
                              <Bookmark className="w-5 h-5" />
                            )}
                          </button>
                        )}

                        <div className={quote.page > 0 && !isThemeOrIdea && !isSummary ? 'pr-10' : ''}>
                          {quote.element && (
                            <p className="mb-3 text-sm uppercase tracking-wide text-[#00D1FF]">
                              {quote.element}
                            </p>
                          )}

                          {quote.text && (
                            <p
                              className="mb-3 whitespace-pre-wrap leading-relaxed text-[#E6F0FF]/80"
                              style={{ textShadow: '0 0 10px rgba(0,209,255,0.1)' }}
                            >
                              {isThemeOrIdea || isSummary ? quote.text : `"${quote.text}"`}
                            </p>
                          )}

                          {quote.meaning && (
                            <p className="mb-3 text-sm leading-relaxed text-[#7FA4D6]">
                              💡 {quote.meaning}
                            </p>
                          )}

                          {quote.page > 0 && !isSummary && (
                            <>
                              <div className="flex items-center gap-2 text-sm mb-3">
                                <span className="rounded border border-[#00D1FF]/30 bg-[#00D1FF]/10 px-2 py-1 text-[#00D1FF]">
                                  Stranica {quote.page}
                                </span>
                              </div>

                              {quote.context && !isThemeOrIdea && (
                                <button
                                  type="button"
                                  onClick={() => toggleContext(quote.id)}
                                  className="flex items-center gap-2 text-sm text-[#E6F0FF]/50 transition-all hover:text-[#00D1FF]"
                                >
                                  {quote.expandedContext ? (
                                    <>
                                      <Minus className="w-4 h-4" />
                                      Sakrij širi kontekst
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4" />
                                      Prikaži širi kontekst
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {quote.expandedContext && quote.context && quote.page > 0 && !isThemeOrIdea && !isSummary && (
                        <div
                          className="rounded-xl border border-[#00D1FF]/10 bg-[#001F54]/20 p-4"
                          style={{ animation: 'fadeIn 0.3s ease-in' }}
                        >
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#E6F0FF]/60">
                            {quote.context}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {followUpQuestions.length > 0 && (
                    <div className="border-t border-[#00D1FF]/10 pt-4">
                      <p className="mb-3 text-sm text-[#E6F0FF]/70" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        Predložena pitanja:
                      </p>

                      <div className="space-y-2">
                        {followUpQuestions.map((q, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleFollowUpClick(q)}
                            className="w-full rounded-lg border border-[#00D1FF]/20 bg-[#001F54]/30 px-4 py-2 text-left text-sm text-[#E6F0FF]/70 transition-all hover:border-[#00D1FF]/50 hover:bg-[#001F54]/50 hover:text-[#E6F0FF]"
                          >
                            → {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : resultType !== 'none' ? (
                <div className="flex h-full items-center justify-center text-center text-[#E6F0FF]/40">
                  <p>Nema rezultata za prikaz</p>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[#E6F0FF]/40">
                  <p>Učitajte PDF i postavite pitanje da vidite rezultate</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroGlow {
          0%, 100% { opacity: 0.35; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 0.55; transform: translate(-50%, 0) scale(1.05); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.75; }
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-glow {
          animation: heroGlow 14s ease-in-out infinite;
        }
        .animate-pulse-soft {
          animation: pulseSoft 8s ease-in-out infinite;
        }
        .animate-hero-in {
          animation: heroIn 0.75s ease-out both;
        }
        .animate-hero-in-delay {
          animation: heroIn 0.75s ease-out 0.12s both;
        }
        .animate-hero-columns {
          animation: heroIn 0.85s ease-out 0.2s both;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-glow,
          .animate-pulse-soft,
          .animate-hero-in,
          .animate-hero-in-delay,
          .animate-hero-columns {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}