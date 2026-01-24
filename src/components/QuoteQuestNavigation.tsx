import { Bookmark } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/quotequest-logo.png';

interface QuoteQuestNavigationProps {
  onOpenSavedQuotes: () => void;
}

export function QuoteQuestNavigation({ onOpenSavedQuotes }: QuoteQuestNavigationProps) {
  const [activeLink, setActiveLink] = useState('home');

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/[0.03]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="QuoteQuest Logo"
              className="object-contain"
              style={{
                width: '170px',
                height: 'auto'
              }}
            />
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8">

              {/* HOME */}
              <a
                href="#home"
                onClick={() => setActiveLink('home')}
                className={`relative text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 ${
                  activeLink === 'home' ? 'text-[#00D1FF]' : ''
                }`}
              >
                Početna
                {activeLink === 'home' && (
                  <span
                    className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#00D1FF]"
                  />
                )}
              </a>

              {/* FEATURES */}
              <a
                href="#features"
                onClick={() => setActiveLink('features')}
                className={`relative text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 ${
                  activeLink === 'features' ? 'text-[#00D1FF]' : ''
                }`}
              >
                Mogućnosti
                {activeLink === 'features' && (
                  <span
                    className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#00D1FF]"
                  />
                )}
              </a>

              {/* ABOUT */}
              <a
                href="#about"
                onClick={() => setActiveLink('about')}
                className={`relative text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 ${
                  activeLink === 'about' ? 'text-[#00D1FF]' : ''
                }`}
              >
                O nama
                {activeLink === 'about' && (
                  <span
                    className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#00D1FF]"
                  />
                )}
              </a>
            </div>

            {/* Saved Quotes Button */}
            <button
              onClick={onOpenSavedQuotes}
              className="flex items-center gap-2 text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 hover:scale-105"
            >
              <Bookmark className="w-5 h-5" />
              <span className="hidden sm:inline">Moji citati</span>
            </button>

          </div>
        </div>
      </div>
    </nav>
  );
}
