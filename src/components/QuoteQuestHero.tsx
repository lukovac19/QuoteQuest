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
import * as pdfjsLib from 'pdfjs-dist';

// Postavi worker za PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

export function QuoteQuestHero({ onQuoteSaved }: QuoteQuestHeroProps) {
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

  // Extract text from PDF
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `\n\n--- Stranica ${i} ---\n${pageText}`;
    }
    
    return fullText;
  };

  const handleSubmit = async () => {
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

    try {
      // Extract text from PDF
      toast.info('Čitam PDF...');
      const bookContent = await extractTextFromPDF(file);

      // Call Vercel Function
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          bookContent: bookContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Greška pri pozivu servera.');
      }

      const data = await response.json();

      // Parse response (ovo moraš prilagoditi ovisno o odgovoru tvog API-ja)
      const answer = data.answer || '';

      // Kreiraj dummy quote sa odgovorom (prilagodi logiku kako ti odgovara)
      const quote: Quote = {
        id: `quote-${Date.now()}`,
        text: answer,
        page: 0,
        isBookmarked: false,
        expandedContext: false,
        context: '',
        element: 'AI Odgovor',
        meaning: null
      };

      setResults([quote]);
      setResultType('quotes');

      toast.success('Analiza završena!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Došlo je do greške pri analizi.');
      setResultType('none');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleBookmark = (quoteId: string) => {
    setResults((prev) =>
      prev.map((quote) => {
        if (quote.id === quoteId) {
          const newState = !quote.isBookmarked;

          if (newState) {
            const savedQuotes = JSON.parse(
              localStorage.getItem('savedQuotes') || '[]'
            );
            savedQuotes.push({
              id: quoteId,
              text: quote.text,
              page: quote.page,
              element: quote.element || null,
              meaning: quote.meaning || null,
              context: quote.context || null,
              dateSaved: new Date().toLocaleDateString('bs-BA', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })
            });
            localStorage.setItem('savedQuotes', JSON.stringify(savedQuotes));
            toast.success('Citat sačuvan!');
            onQuoteSaved();
          } else {
            const savedQuotes = JSON.parse(
              localStorage.getItem('savedQuotes') || '[]'
            );
            const filtered = savedQuotes.filter((q: any) => q.id !== quoteId);
            localStorage.setItem('savedQuotes', JSON.stringify(filtered));
            toast.info('Citat uklonjen iz sačuvanih');
            onQuoteSaved();
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
      className="relative min-h-screen flex items-center justify-center bg-[#0A0A0A] pt-20"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#001F54]/20 via-transparent to-transparent" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 lg:px-12 py-20 w-full">
        <div className="text-center mb-16">
          <h1
            className="text-[#E6F0FF] mb-6"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              lineHeight: '1.1',
              letterSpacing: '-0.02em'
            }}
          >
            Analizirajte knjige uz AI
          </h1>
          <p className="text-[#E6F0FF]/70 text-lg md:text-xl max-w-3xl mx-auto">
            Učitajte PDF, postavite pitanje i pronađite tačne citate i stranice.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label
                  className="block text-[#E6F0FF]"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  1. Učitaj PDF
                </label>

                {fileName && (
                  <button
                    onClick={resetAnalysis}
                    className="text-[#E6F0FF]/50 hover:text-[#00D1FF] transition-all text-sm flex items-center gap-1"
                  >
                    <RotateCcw className="w-4 h-4" />
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
                  className={`flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-[#001F54]/40 border-2 border-dashed transition-all cursor-pointer min-h-[120px] ${
                    isDragOver
                      ? 'border-[#00D1FF] bg-[#001F54]/70 shadow-[0_0_20px_rgba(0,209,255,0.3)]'
                      : 'border-[#00D1FF]/30 hover:border-[#00D1FF]/60 hover:bg-[#001F54]/60'
                  }`}
                  style={{
                    boxShadow: isDragOver
                      ? '0 0 20px rgba(0,209,255,0.3)'
                      : 'inset 0 1px 0 0 rgba(255,255,255,0.03)'
                  }}
                >
                  <Upload
                    className={`w-8 h-8 transition-all ${
                      isDragOver ? 'text-[#00D1FF] scale-110' : 'text-[#00D1FF]'
                    }`}
                  />

                  <div className="text-center">
                    {fileName ? (
                      <>
                        <p className="text-[#E6F0FF]">{fileName}</p>
                        <p className="text-[#00D1FF] text-sm">✓ Učitano</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[#E6F0FF]">Klikni ili prevuci PDF</p>
                        <p className="text-[#E6F0FF]/50 text-sm">
                          Maksimalno 10MB
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label
                className="block text-[#E6F0FF] mb-3"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
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
                  className="min-h-[150px] bg-[#001F54]/40 border-[#00D1FF]/30 text-[#E6F0FF] placeholder:text-[#E6F0FF]/40 focus:border-[#00D1FF] resize-none transition-all"
                  style={{
                    boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)'
                  }}
                />

                {isCharacterizationQuestion && (
                  <p className="text-[#E6F0FF]/40 text-xs mt-2">
                    Tip: za karakterizaciju upiši TAČNO ime lika, npr.{' '}
                    <span className="text-[#00D1FF]">
                      "Karakterizacija lika Nora"
                    </span>
                  </p>
                )}

                {showSuggestions && question.length === 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[#E6F0FF]/50 text-sm">Prijedlozi:</p>

                    <div className="flex flex-wrap gap-2">
                      {SMART_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-3 py-1 rounded-full bg-[#001F54]/60 border border-[#00D1FF]/30 text-[#E6F0FF]/80 text-sm hover:border-[#00D1FF] hover:bg-[#001F54]/80 hover:shadow-[0_0_10px_rgba(0,209,255,0.2)] transition-all"
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
              className="w-full py-6 rounded-xl bg-gradient-to-r from-[#00D1FF] to-[#0FB2FF] hover:from-[#00D1FF]/90 hover:to-[#0FB2FF]/90 text-[#0A0A0A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              <Send className="w-5 h-5 mr-2" />
              {isAnalyzing ? 'Analizira se...' : 'Počni'}
            </Button>
          </div>

          <div>
            <label
              className="block text-[#E6F0FF] mb-3"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              3. Rezultati
            </label>

            <div
              className="p-6 rounded-xl bg-[#001F54]/40 border border-[#00D1FF]/30 min-h-[380px] max-h-[600px] overflow-y-auto custom-scrollbar"
              style={{
                boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)'
              }}
            >
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <Loader2 className="w-12 h-12 text-[#00D1FF] animate-spin" />
                  <p className="text-[#E6F0FF]/60">AI analizira tekst...</p>
                </div>
              ) : resultType !== 'none' && results.length > 0 ? (
                <div className="space-y-6">
                  {resultType === 'count' && countMeta && (
                    <div className="p-4 rounded-xl bg-[#0A0A0A]/50 border border-[#00D1FF]/30 mb-4">
                      <p className="text-[#9BD8FF] uppercase tracking-wide font-[Orbitron] mb-2 text-sm">
                        STATISTIKA RIJEČI
                      </p>
                      <p className="text-[#E6F0FF] mb-1">
                        Riječ: <strong>{countMeta.word}</strong>
                      </p>
                      <p className="text-[#E6F0FF] mb-3">
                        Ukupno: <strong>{countMeta.total} puta</strong>
                      </p>
                      
                      {countMeta.perPage.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[#9BD8FF] text-xs mb-1">
                            Po stranicama:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {countMeta.perPage.slice(0, 10).map((p, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 rounded bg-[#00D1FF]/10 text-[#00D1FF] text-xs border border-[#00D1FF]/30"
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
                      <div className="p-4 rounded-xl bg-[#0A0A0A]/50 border border-[#00D1FF]/20 hover:border-[#00D1FF]/40 transition-all group">
                        {quote.page > 0 && !isThemeOrIdea && !isSummary && (
                          <button
                            onClick={() => toggleBookmark(quote.id)}
                            className={`absolute top-3 right-3 p-2 rounded-lg transition-all duration-300 ${
                              quote.isBookmarked
                                ? 'text-[#00D1FF] bg-[#00D1FF]/10'
                                : 'text-[#E6F0FF]/40 hover:text-[#00D1FF] hover:bg-[#00D1FF]/10'
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
                            <p className="text-[#00D1FF] text-sm uppercase tracking-wide font-[Orbitron] mb-3">
                              {quote.element}
                            </p>
                          )}

                          {quote.text && (
                            <p
                              className="text-[#E6F0FF]/80 leading-relaxed mb-3 whitespace-pre-wrap"
                              style={{
                                textShadow: '0 0 10px rgba(0,209,255,0.1)'
                              }}
                            >
                              {isThemeOrIdea || isSummary ? quote.text : `"${quote.text}"`}
                            </p>
                          )}

                          {quote.meaning && (
                            <p className="text-[#7FA4D6] text-sm mb-3 leading-relaxed">
                              💡 {quote.meaning}
                            </p>
                          )}

                          {quote.page > 0 && !isSummary && (
                            <>
                              <div className="flex items-center gap-2 text-sm mb-3">
                                <span className="px-2 py-1 rounded bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/30">
                                  Stranica {quote.page}
                                </span>
                              </div>

                              {quote.context && !isThemeOrIdea && (
                                <button
                                  onClick={() => toggleContext(quote.id)}
                                  className="flex items-center gap-2 text-[#E6F0FF]/50 hover:text-[#00D1FF] transition-all text-sm"
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
                          className="p-4 rounded-xl bg-[#001F54]/20 border border-[#00D1FF]/10"
                          style={{ animation: 'fadeIn 0.3s ease-in' }}
                        >
                          <p className="text-[#E6F0FF]/60 text-sm leading-relaxed whitespace-pre-wrap">
                            {quote.context}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {followUpQuestions.length > 0 && (
                    <div className="pt-4 border-t border-[#00D1FF]/10">
                      <p
                        className="text-[#E6F0FF]/70 text-sm mb-3"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        Predložena pitanja:
                      </p>

                      <div className="space-y-2">
                        {followUpQuestions.map((q, index) => (
                          <button
                            key={index}
                            onClick={() => handleFollowUpClick(q)}
                            className="w-full text-left px-4 py-2 rounded-lg bg-[#001F54]/30 border border-[#00D1FF]/20 text-[#E6F0FF]/70 text-sm hover:border-[#00D1FF]/50 hover:bg-[#001F54]/50 hover:text-[#E6F0FF] transition-all"
                          >
                            → {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : resultType !== 'none' ? (
                <div className="flex items-center justify-center h-full text-[#E6F0FF]/40 text-center">
                  <p>Nema rezultata za prikaz</p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[#E6F0FF]/40 text-center">
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
      `}</style>
    </section>
  );
}