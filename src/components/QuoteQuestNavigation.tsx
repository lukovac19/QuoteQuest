import { Bookmark, LogIn, User, LogOut, UserCircle } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/quotequest-logo.png';
import { authHelpers } from '../lib/supabase';
import { toast } from 'sonner';

interface QuoteQuestNavigationProps {
  onOpenSavedQuotes: () => void;
  currentUser: any;
  onLogin: () => void;
  onOpenAccount: () => void;
}

export function QuoteQuestNavigation({
  onOpenSavedQuotes,
  currentUser,
  onLogin,
  onOpenAccount,
}: QuoteQuestNavigationProps) {
  const [activeLink, setActiveLink] = useState<'home' | 'about'>('home');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await authHelpers.signOut();
    setIsDropdownOpen(false);
    toast.success('Uspješno ste se odjavili');
  };

  const handleOpenAccountFromMenu = () => {
    setIsDropdownOpen(false);
    onOpenAccount();
  };

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.03] bg-[#0A0A0A]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="QuoteQuest Logo"
              className="object-contain"
              style={{ width: '170px', height: 'auto' }}
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-8 md:flex">
              <a
                href="#home"
                onClick={() => setActiveLink('home')}
                className={`relative transition-all duration-300 ${
                  activeLink === 'home'
                    ? 'text-[#00D1FF]'
                    : 'text-[#E6F0FF]/70 hover:text-[#00D1FF]'
                }`}
              >
                Početna
                {activeLink === 'home' && (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-[#00D1FF]" />
                )}
              </a>

              <a
                href="#about"
                onClick={() => setActiveLink('about')}
                className={`relative transition-all duration-300 ${
                  activeLink === 'about'
                    ? 'text-[#00D1FF]'
                    : 'text-[#E6F0FF]/70 hover:text-[#00D1FF]'
                }`}
              >
                O nama
                {activeLink === 'about' && (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-[#00D1FF]" />
                )}
              </a>
            </div>

            {currentUser && (
              <button
                type="button"
                onClick={onOpenSavedQuotes}
                className="flex items-center gap-2 text-[#E6F0FF]/70 transition-all duration-300 hover:scale-105 hover:text-[#00D1FF]"
              >
                <Bookmark className="h-5 w-5" />
                <span className="hidden sm:inline">Moji citati</span>
              </button>
            )}

            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-[#00D1FF]/30 px-4 py-2 text-[#00D1FF] transition-all duration-300 hover:border-[#00D1FF] hover:bg-[#00D1FF]/10"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  <User className="h-4 w-4" />
                  <span className="hidden text-sm sm:inline">{currentUser.name}</span>
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[#00D1FF]/30 bg-[#001F54] shadow-xl">
                      <div className="border-b border-[#00D1FF]/20 bg-[#00D1FF]/10 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-[#00D1FF]/20 p-2">
                            <User className="h-5 w-5 text-[#00D1FF]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-[#E6F0FF]">{currentUser.name}</p>
                            <p className="truncate text-xs text-[#E6F0FF]/60">{currentUser.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="py-2">
                        <button
                          type="button"
                          onClick={handleOpenAccountFromMenu}
                          className="flex w-full items-center gap-3 px-4 py-3 text-[#E6F0FF] transition-colors duration-200 hover:bg-[#00D1FF]/10"
                        >
                          <UserCircle className="h-4 w-4 text-[#00D1FF]" />
                          <span className="text-sm">Moj nalog</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 px-4 py-3 text-[#E6F0FF] transition-colors duration-200 hover:bg-red-500/10"
                        >
                          <LogOut className="h-4 w-4 text-red-400" />
                          <span className="text-sm">Odjavi se</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="flex items-center gap-2 rounded-lg border border-[#00D1FF]/30 px-4 py-2 text-[#00D1FF] transition-all duration-300 hover:border-[#00D1FF] hover:bg-[#00D1FF]/10"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                <LogIn className="h-4 w-4" />
                <span className="text-sm">Prijavi se</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
