import { Bookmark, LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/quotequest-logo.png';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface QuoteQuestNavigationProps {
  onOpenSavedQuotes: () => void;
  onOpenAuth: () => void;
  user: any;
}

export function QuoteQuestNavigation({
  onOpenSavedQuotes,
  onOpenAuth,
  user,
}: QuoteQuestNavigationProps) {
  const [activeLink, setActiveLink] = useState<'home' | 'about'>('home');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Uspješno ste se odjavili');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/[0.03]">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">

          {/* LOGO */}
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="QuoteQuest Logo"
              className="object-contain"
              style={{ width: '170px', height: 'auto' }}
            />
          </div>

          {/* NAV + ACTIONS */}
          <div className="flex items-center gap-6">

            {/* LINKS */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#home"
                onClick={() => setActiveLink('home')}
                className={`relative text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 ${
                  activeLink === 'home' ? 'text-[#00D1FF]' : ''
                }`}
              >
                Početna
                {activeLink === 'home' && (
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#00D1FF]" />
                )}
              </a>

              <a
                href="#about"
                onClick={() => setActiveLink('about')}
                className={`relative text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 ${
                  activeLink === 'about' ? 'text-[#00D1FF]' : ''
                }`}
              >
                O nama
                {activeLink === 'about' && (
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#00D1FF]" />
                )}
              </a>
            </div>

            {/* SAVED QUOTES */}
            {user && (
              <button
                onClick={onOpenSavedQuotes}
                className="flex items-center gap-2 text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 hover:scale-105"
              >
                <Bookmark className="w-5 h-5" />
                <span className="hidden sm:inline">Moji citati</span>
              </button>
            )}

            {/* AUTH BUTTON */}
            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                           border border-[#00D1FF]/30 text-[#00D1FF]
                           hover:bg-[#00D1FF]/10 hover:border-[#00D1FF]
                           transition-all duration-300"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Odjavi se</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                           border border-[#00D1FF]/30 text-[#00D1FF]
                           hover:bg-[#00D1FF]/10 hover:border-[#00D1FF]
                           transition-all duration-300"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <LogIn className="w-4 h-4" />
                <span className="text-sm">Prijavi se</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
