import { Instagram, Mail } from 'lucide-react';

export function QuoteQuestFooter() {
  return (
    <footer className="relative bg-[#0A0A0A] border-t border-[#00D1FF]/10">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="text-center space-y-4">
          
          <p className="text-[#E6F0FF]/60 text-sm max-w-[600px] mx-auto leading-relaxed">
            Pratite nas na Instagramu da budete u toku! Za sva pitanja, nedoumice ili prijedloge pišite nam na Instagram ili email, uvijek smo tu :)
          </p>

          <div className="flex items-center justify-center gap-6">
            
              href="https://www.instagram.com/quotequest.site?igsh=cGMzY2pvYnI3bHVr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E6F0FF]/50 hover:text-[#00D1FF] transition-all duration-300 hover:scale-110"
            >
              <Instagram className="w-5 h-5" />
            </a>

            
              href="mailto:info.quotequest@gmail.com"
              className="text-[#E6F0FF]/50 hover:text-[#00D1FF] transition-all duration-300 hover:scale-110"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>

          <p className="text-[#E6F0FF]/50 text-sm">
            © 2025 QuoteQuest — Sva prava zadržana.
          </p>
        </div>
      </div>
    </footer>
  );
}