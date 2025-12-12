import { X, Trash2, Bookmark, FileDown, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './ui/drawer';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { useState } from 'react';
import jsPDF from 'jspdf';

interface SavedQuote {
  id: string;
  text: string;
  page: number;
  dateSaved: string;
  element?: string | null;
  meaning?: string | null;
  context?: string | null;
}

interface SavedQuotesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: SavedQuote[];
  onDeleteQuote: (id: string) => void;
  onDeleteAll: () => void;
  isMobile: boolean;
}

export function SavedQuotesModal({ 
  open, 
  onOpenChange, 
  quotes, 
  onDeleteQuote, 
  onDeleteAll,
  isMobile 
}: SavedQuotesModalProps) {
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedQuotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const exportAsPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Moji Citati - QuoteQuest', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ukupno citata: ${quotes.length}`, 105, 28, { align: 'center' });
    doc.text(`Datum: ${new Date().toLocaleDateString('bs-BA')}`, 105, 33, { align: 'center' });

    let yPosition = 45;
    const pageHeight = 280;
    const margin = 15;
    const maxWidth = 180;

    quotes.forEach((quote, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      // Quote number
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Citat ${index + 1}`, margin, yPosition);
      yPosition += 7;

      // Element label
      if (quote.element) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 150, 255);
        doc.text(quote.element.toUpperCase(), margin, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 6;
      }

      // Quote text
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      const quoteLines = doc.splitTextToSize(`"${quote.text}"`, maxWidth);
      doc.text(quoteLines, margin, yPosition);
      yPosition += quoteLines.length * 5 + 3;

      // Meaning
      if (quote.meaning) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('💡 Značenje:', margin, yPosition);
        yPosition += 5;
        const meaningLines = doc.splitTextToSize(quote.meaning, maxWidth - 5);
        doc.text(meaningLines, margin + 5, yPosition);
        yPosition += meaningLines.length * 4 + 3;
      }

      // Page number and date
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Stranica ${quote.page} • ${quote.dateSaved}`, margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 6;

      // Context (if exists)
      if (quote.context) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text('Kontekst:', margin, yPosition);
        yPosition += 4;
        const contextLines = doc.splitTextToSize(quote.context, maxWidth - 5);
        doc.text(contextLines, margin + 5, yPosition);
        yPosition += contextLines.length * 3.5 + 5;
        doc.setTextColor(0, 0, 0);
      }

      // Separator line
      if (index < quotes.length - 1) {
        doc.setDrawColor(0, 150, 255);
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition, 195, yPosition);
        yPosition += 8;
      }
    });

    // Save PDF
    doc.save('moji-citati-quotequest.pdf');
  };

  const content = (
    <div className="space-y-4">
      {quotes.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={exportAsPDF}
            variant="outline"
            size="sm"
            className="border-[#00D1FF]/30 text-[#00D1FF] hover:bg-[#00D1FF]/10 hover:text-[#00D1FF] hover:border-[#00D1FF]/50"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button
            onClick={onDeleteAll}
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50"
          >
            <Trash className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>
      )}
      
      {quotes.length === 0 ? (
        <div className="text-center py-12">
          <Bookmark className="w-16 h-16 text-[#00D1FF]/30 mx-auto mb-4" />
          <p className="text-[#E6F0FF]/60">Nema sačuvanih citata</p>
          <p className="text-[#E6F0FF]/40 text-sm mt-2">
            Kliknite 🔖 ikonu na citatu da ga sačuvate
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {quotes.map((quote) => {
              const isExpanded = expandedQuotes.has(quote.id);
              const hasContext = quote.context && quote.context.length > 0;

              return (
                <div
                  key={quote.id}
                  className="p-4 rounded-xl bg-[#001F54]/40 border border-[#00D1FF]/30 hover:border-[#00D1FF]/50 transition-all"
                  style={{ boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="flex-1 space-y-2">
                      {quote.element && (
                        <p className="text-[#00D1FF] text-xs uppercase tracking-wide font-[Orbitron]">
                          {quote.element}
                        </p>
                      )}

                      <p className="text-[#E6F0FF]/80 leading-relaxed">
                        "{quote.text}"
                      </p>

                      {quote.meaning && (
                        <p className="text-[#7FA4D6] text-sm italic">
                          💡 {quote.meaning}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onDeleteQuote(quote.id)}
                      className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#E6F0FF]/40 mb-2">
                    <span>Stranica {quote.page}</span>
                    <span>•</span>
                    <span>{quote.dateSaved}</span>
                  </div>

                  {hasContext && (
                    <>
                      <button
                        onClick={() => toggleExpanded(quote.id)}
                        className="flex items-center gap-2 text-[#E6F0FF]/50 hover:text-[#00D1FF] transition-all text-xs mt-2"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Sakrij kontekst
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Prikaži kontekst
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 p-3 rounded-lg bg-[#0A0A0A]/50 border border-[#00D1FF]/10">
                          <p className="text-[#E6F0FF]/60 text-xs leading-relaxed whitespace-pre-wrap">
                            {quote.context}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-[#0A0A0A] border-t border-[#00D1FF]/30">
          <DrawerHeader>
            <DrawerTitle className="text-[#E6F0FF] flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              <Bookmark className="w-5 h-5 text-[#00D1FF]" />
              Moji citati
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border border-[#00D1FF]/30 text-[#E6F0FF] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[#E6F0FF] flex items-center gap-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            <Bookmark className="w-5 h-5 text-[#00D1FF]" />
            Moji citati
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}