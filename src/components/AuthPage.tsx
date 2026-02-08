import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mail, Lock, User, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: any) => void;
}

export function AuthPage({ open, onOpenChange, onSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password || (!isLogin && !name)) {
      setError('Molimo popunite sva polja');
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Unesite validnu email adresu');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // LOGIN
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) throw error;

        toast.success('Uspješno prijavljeni!');
        onSuccess(data.user);
        onOpenChange(false);
        resetForm();
      } else {
        // SIGNUP
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              full_name: name,
            }
          }
        });

        if (error) throw error;

        toast.success('Nalog kreiran! Provjerite email za verifikaciju.');
        onSuccess(data.user);
        onOpenChange(false);
        resetForm();
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(error.message || 'Došlo je do greške');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  if (!open) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[200] bg-[#0A0F18]/95 backdrop-blur-sm flex items-center justify-center p-8"
        style={{
          animation: 'fadeIn 300ms ease-out'
        }}
      >
        <button
          onClick={() => {
            onOpenChange(false);
            resetForm();
          }}
          className="absolute top-8 right-8 z-10 w-10 h-10 flex items-center justify-center 
                     text-[#00CFFF] hover:text-[#E6F0FF] transition-colors duration-150
                     bg-[#04245A]/40 rounded-full border border-[#00CFFF]/20 
                     hover:border-[#00CFFF]/50 hover:bg-[#04245A]/60"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-full max-w-[1400px] h-[90vh] grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
          {/* Left side - Branding */}
          <div className="relative bg-gradient-to-br from-[#0A0F18] via-[#04245A] to-[#001F54] 
                          flex items-center justify-center p-16 hidden md:flex">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] 
                              bg-[#00CFFF] rounded-full blur-[120px] animate-pulse" />
              <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] 
                              bg-[#0FB2FF] rounded-full blur-[100px] animate-pulse"
                   style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 max-w-lg">
              <div className="mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl 
                                bg-[#00CFFF]/20 border border-[#00CFFF]/30 mb-6"
                     style={{
                       boxShadow: '0 0 30px rgba(0, 207, 255, 0.2)'
                     }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" 
                       stroke="currentColor" strokeWidth="2" className="text-[#00CFFF]">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                </div>
                <h1 
                  className="text-5xl text-[#E6F0FF] mb-6 leading-tight"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  Dobrodošli na<br />
                  <span className="text-[#00CFFF]">QuoteQuest</span>
                </h1>
                <p className="text-[#E6F0FF]/70 text-lg leading-relaxed">
                  Analizirajte knjige uz moć umjetne inteligencije. Pronađite citate, 
                  istražite teme i dublje razumijte književna djela.
                </p>
              </div>

              <div className="space-y-5">
                {[
                  'Instant AI pretraga kroz knjige',
                  'Precizni citati sa stranicama',
                  'Inteligentna analiza sadržaja',
                  'Sačuvajte omiljene citate'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-[#00CFFF]"
                         style={{
                           boxShadow: '0 0 10px rgba(0, 207, 255, 0.5)'
                         }} />
                    <span className="text-[#E6F0FF]/80 text-base">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right side - Form */}
          <div className="bg-[#0A0F18] flex items-center justify-center p-8 md:p-16 overflow-y-auto">
            <div className="w-full max-w-md">
              <div className="mb-10">
                <h2 
                  className="text-3xl text-[#E6F0FF] mb-3"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {isLogin ? 'Prijavi se' : 'Kreiraj nalog'}
                </h2>
                <p className="text-[#E6F0FF]/60 text-base">
                  {isLogin 
                    ? 'Nastavi gdje si stao' 
                    : 'Započni svoju AI analizu'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-[#E6F0FF]/80 text-sm block">
                      Puno ime
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 
                                      text-[#00CFFF]/40 group-focus-within:text-[#00CFFF] 
                                      transition-colors duration-150" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Vaše ime i prezime"
                        disabled={loading}
                        className="bg-[#04245A]/30 border-[#00CFFF]/20 text-[#E6F0FF] 
                                 pl-12 pr-4 h-14 text-base
                                 focus:border-[#00CFFF] focus:bg-[#04245A]/40
                                 transition-all duration-150 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-[#E6F0FF]/80 text-sm block">
                    Email adresa
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 
                                    text-[#00CFFF]/40 group-focus-within:text-[#00CFFF] 
                                    transition-colors duration-150" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vas@email.com"
                      disabled={loading}
                      className="bg-[#04245A]/30 border-[#00CFFF]/20 text-[#E6F0FF] 
                               pl-12 pr-4 h-14 text-base
                               focus:border-[#00CFFF] focus:bg-[#04245A]/40
                               transition-all duration-150 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-[#E6F0FF]/80 text-sm block">
                    Lozinka
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 
                                    text-[#00CFFF]/40 group-focus-within:text-[#00CFFF] 
                                    transition-colors duration-150" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Najmanje 6 karaktera"
                      disabled={loading}
                      className="bg-[#04245A]/30 border-[#00CFFF]/20 text-[#E6F0FF] 
                               pl-12 pr-4 h-14 text-base
                               focus:border-[#00CFFF] focus:bg-[#04245A]/40
                               transition-all duration-150 rounded-xl"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 rounded-xl bg-gradient-to-r from-[#00CFFF] to-[#0FB2FF] 
                           hover:from-[#00CFFF]/90 hover:to-[#0FB2FF]/90 
                           text-[#0A0F18] transition-all duration-150 
                           shadow-[0_0_25px_rgba(0,207,255,0.4)] 
                           hover:shadow-[0_0_35px_rgba(0,207,255,0.5)]
                           text-base font-bold disabled:opacity-50"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  {loading ? 'Učitavanje...' : (isLogin ? 'Prijavi se' : 'Kreiraj nalog')}
                </Button>

                <div className="pt-6 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError('');
                    }}
                    disabled={loading}
                    className="text-[#00CFFF] hover:text-[#00CFFF]/80 text-sm 
                             transition-colors duration-150 disabled:opacity-50"
                  >
                    {isLogin ? (
                      <>
                        <span className="text-[#E6F0FF]/60">Nemate nalog? </span>
                        <span className="underline underline-offset-2 font-medium">
                          Registrujte se
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[#E6F0FF]/60">Već imate nalog? </span>
                        <span className="underline underline-offset-2 font-medium">
                          Prijavite se
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}