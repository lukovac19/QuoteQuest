import { Instagram, Mail } from 'lucide-react';

export function QuoteQuestFooter() {
  return (
    <footer className="relative border-t border-[#00D1FF]/10 bg-[#0A0A0A]">
      <div className="mx-auto flex max-w-[1200px] justify-center px-6 py-8">
        <div className="flex w-full max-w-[640px] flex-col items-center gap-4 text-center">
          <p className="text-sm leading-relaxed text-[#E6F0FF]/60">
            Pratite nas na Instagramu da budete u toku! Za sva pitanja, nedoumice ili prijedloge
            pišite nam na Instagram ili email, uvijek smo tu :)
          </p>

          <div className="flex shrink-0 items-center justify-center gap-6">
            <a
              href="https://www.instagram.com/quotequest.site?igsh=cGMzY2pvYnI3bHVr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E6F0FF]/50 transition-all duration-300 hover:scale-110 hover:text-[#00D1FF]"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="mailto:info.quotequest@gmail.com"
              className="text-[#E6F0FF]/50 transition-all duration-300 hover:scale-110 hover:text-[#00D1FF]"
            >
              <Mail className="h-5 w-5" />
            </a>
          </div>

          <p className="max-w-full text-xs tracking-wide text-[#E6F0FF]/40">
            QuoteQuest — Ema Lukovac · {new Date().getFullYear()} · Sva prava zadržana.
          </p>
        </div>
      </div>
    </footer>
  );
}
