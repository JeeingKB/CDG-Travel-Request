
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ShieldCheck, LayoutDashboard, Globe, AlertCircle, Briefcase, Server } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signInWithAzure, signInMock, isLoading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAzureLogin = async () => {
      setErrorMsg(null);
      setIsRedirecting(true);
      try {
          // This function usually redirects, so code below await might not run if successful
          await signInWithAzure();
          
          // If we are still here after a few seconds, likely configuration issue or popup blocked
          // But technically signInWithAzure returns { error } if supabase is missing
          const res = await signInWithAzure(); 
          if (res?.error) {
              setErrorMsg(res.error.message);
              setIsRedirecting(false);
          }
      } catch (e) {
          setErrorMsg("An unexpected error occurred.");
          setIsRedirecting(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px] opacity-60"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-[100px] opacity-60"></div>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-xl relative z-10 border border-slate-100">
            <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                    <span className="text-white font-bold text-3xl">C</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Welcome Back</h1>
                <p className="text-slate-500 mt-2 text-sm">Sign in to CDG Travel Portal to manage your requests.</p>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-left animate-fade-in">
                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="text-sm font-bold text-red-700">Login Failed</h4>
                        <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {/* AZURE AD LOGIN BUTTON */}
                <button 
                    onClick={handleAzureLogin}
                    disabled={isRedirecting || isLoading}
                    className="w-full flex items-center justify-center gap-3 bg-[#2F2F2F] hover:bg-black text-white px-6 py-4 rounded-xl font-medium transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                    {isRedirecting ? (
                        <Loader2 size={20} className="animate-spin text-white"/>
                    ) : (
                        // Microsoft Logo SVG
                        <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                    )}
                    <span>{isRedirecting ? 'Redirecting...' : 'Sign in with Microsoft'}</span>
                </button>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400 font-bold tracking-wider">Or Select Demo Role</span>
                    </div>
                </div>

                {/* DEMO BUTTONS - Categorized */}
                <div className="grid grid-cols-2 gap-3">
                    {/* General Users */}
                    <button 
                        onClick={() => signInMock('Employee')}
                        className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-blue-300 transition-all flex flex-col items-center gap-1 group"
                    >
                        <ShieldCheck size={20} className="text-slate-400 group-hover:text-blue-600"/>
                        <span className="text-xs font-bold text-slate-600">Employee</span>
                    </button>
                    <button 
                        onClick={() => signInMock('Manager')}
                        className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-orange-300 transition-all flex flex-col items-center gap-1 group"
                    >
                        <ShieldCheck size={20} className="text-slate-400 group-hover:text-orange-600"/>
                        <span className="text-xs font-bold text-slate-600">Manager</span>
                    </button>
                    
                    {/* Executives */}
                    <button 
                        onClick={() => signInMock('President')}
                        className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-yellow-300 transition-all flex flex-col items-center gap-1 col-span-2 group"
                    >
                        <Briefcase size={20} className="text-slate-400 group-hover:text-yellow-600"/>
                        <span className="text-xs font-bold text-slate-600">President / CEO</span>
                    </button>

                    {/* Admin / Ops */}
                    <button 
                        onClick={() => signInMock('ADS')}
                        className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-purple-300 transition-all flex flex-col items-center gap-1 group"
                    >
                        <LayoutDashboard size={20} className="text-slate-400 group-hover:text-purple-600"/>
                        <span className="text-xs font-bold text-slate-600">ADS (Agent)</span>
                    </button>

                    <button 
                        onClick={() => signInMock('IT_ADMIN')}
                        className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-red-300 transition-all flex flex-col items-center gap-1 group"
                    >
                        <Server size={20} className="text-slate-400 group-hover:text-red-600"/>
                        <span className="text-xs font-bold text-slate-600">IT Admin</span>
                    </button>
                </div>
            </div>

            <div className="mt-8 text-center">
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Globe size={12}/> Supports Single Sign-On (SSO) via Azure AD
                </p>
            </div>
        </div>
    </div>
  );
};
