import { Bookmark, LogIn, User, LogOut, UserCircle } from 'lucide-react';
import { useState } from 'react';
import logo from '../assets/quotequest-logo.png';
import { authHelpers } from '../lib/supabase';
import { toast } from 'sonner';
import { AccountModal } from './AccountModal';

interface QuoteQuestNavigationProps {
  onOpenSavedQuotes: () => void;
  currentUser: any;
  onLogin: () => void;
  onOpenAccount: () => void;
  questionsRemaining: number;
  onUpgrade: () => void;
}

export function QuoteQuestNavigation({
  onOpenSavedQuotes,
  currentUser,
  onLogin,
  onOpenAccount,
  questionsRemaining,
  onUpgrade,
}: QuoteQuestNavigationProps) {
  const [activeLink, setActiveLink] = useState<'home' | 'about'>('home');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  const handleLogout = async () => {
    await authHelpers.signOut();
    setIsDropdownOpen(false);
    toast.success('Uspješno ste se odjavili');
  };

  const handleOpenAccount = () => {
    setIsDropdownOpen(false);
    setIsAccountModalOpen(true);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/[0.03]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="QuoteQuest Logo"
                className="object-contain"
                style={{ width: '170px', height: 'auto' }}
              />
            </div>

            <div className="flex items-center gap-6">
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

              {currentUser && (
                <button
                  onClick={onOpenSavedQuotes}
                  className="flex items-center gap-2 text-[#E6F0FF]/70 hover:text-[#00D1FF] transition-all duration-300 hover:scale-105"
                >
                  <Bookmark className="w-5 h-5" />
                  <span className="hidden sm:inline">Moji citati</span>
                </button>
              )}

              {currentUser ? (
                <div className="relative">
                  {/* Profile Button with Dropdown */}
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00D1FF]/30 text-[#00D1FF] hover:bg-[#00D1FF]/10 hover:border-[#00D1FF] transition-all duration-300"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm hidden sm:inline">{currentUser.name}</span>
                  </button>

                  {/* Dropdown Menu */}
                  {isDropdownOpen && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsDropdownOpen(false)}
                      />
                      
                      {/* Dropdown Content */}
                      <div className="absolute right-0 mt-2 w-56 bg-[#001F54] border border-[#00D1FF]/30 rounded-xl shadow-xl overflow-hidden z-50">
                        {/* User Info Header */}
                        <div className="px-4 py-3 bg-[#00D1FF]/10 border-b border-[#00D1FF]/20">
                          <div className="flex items-center gap-3">
                            <div className="bg-[#00D1FF]/20 p-2 rounded-full">
                              <User className="w-5 h-5 text-[#00D1FF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[#E6F0FF] font-medium truncate">{currentUser.name}</p>
                              <p className="text-[#E6F0FF]/60 text-xs truncate">{currentUser.email}</p>
                            </div>
                          </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                          <button
                            onClick={handleOpenAccount}
                            className="w-full flex items-center gap-3 px-4 py-3 text-[#E6F0FF] hover:bg-[#00D1FF]/10 transition-colors duration-200"
                          >
                            <UserCircle className="w-4 h-4 text-[#00D1FF]" />
                            <span className="text-sm">Moj Nalog</span>
                          </button>

                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-[#E6F0FF] hover:bg-red-500/10 transition-colors duration-200"
                          >
                            <LogOut className="w-4 h-4 text-red-400" />
                            <span className="text-sm">Odjavi se</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00D1FF]/30 text-[#00D1FF] hover:bg-[#00D1FF]/10 hover:border-[#00D1FF] transition-all duration-300"
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

      {/* Account Modal */}
      <AccountModal
        open={isAccountModalOpen}
        onOpenChange={setIsAccountModalOpen}
        currentUser={currentUser}
        questionsRemaining={questionsRemaining}
        onUpgrade={onUpgrade}
      />
    </>
  );
}