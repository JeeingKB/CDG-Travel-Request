
import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, Settings, LogOut, Bell, UserCircle, List, Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation, Language } from '../services/translations';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: any) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  const { t, language, setLanguage } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = [
    { id: 'DASHBOARD', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'NEW_REQUEST', icon: PlusCircle, label: t('new_request') },
    { id: 'MY_REQUESTS', icon: List, label: t('my_requests') },
    { id: 'SETTINGS', icon: Settings, label: t('settings') },
  ];

  const languages: { code: Language; label: string; flag: string }[] = [
      { code: 'th', label: 'ไทย (Thai)', flag: '🇹🇭' },
      { code: 'en', label: 'English', flag: '🇬🇧' },
      { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' }
  ];

  const currentLang = languages.find(l => l.code === language);

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar - Hidden on Print */}
      <aside className="w-20 lg:w-72 bg-white border-r border-slate-100 flex flex-col fixed h-full z-20 transition-all duration-300 print:hidden">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="font-bold text-lg text-slate-800 hidden lg:block tracking-tight">{t('app.title')}</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${activeView === item.id 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <item.icon size={22} className={activeView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'} />
              <span className="font-medium hidden lg:block">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 rounded-xl transition-colors">
            <LogOut size={22} />
            <span className="font-medium hidden lg:block">{t('sign_out')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content - No Margin on Print */}
      <main className="flex-1 ml-20 lg:ml-72 transition-all duration-300 print:ml-0 print:w-full">
        {/* Top Header - Hidden on Print - Increased z-index to 40 */}
        <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 px-8 flex items-center justify-between print:hidden">
          <div className="text-sm text-slate-400 font-medium">
            {new Date().toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-4">
            
            {/* Language Dropdown */}
            <div className="relative" ref={langMenuRef}>
                <button 
                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-700 transition-colors"
                >
                    <span className="text-lg">{currentLang?.flag}</span>
                    <span className="hidden sm:inline">{currentLang?.label.split(' ')[0]}</span>
                    <ChevronDown size={14} className={`transition-transform ${isLangMenuOpen ? 'rotate-180' : ''}`}/>
                </button>
                
                {isLangMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                        {languages.map(lang => (
                            <button
                                key={lang.code}
                                onClick={() => { setLanguage(lang.code); setIsLangMenuOpen(false); }}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-2 text-sm
                                ${language === lang.code ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-lg">{lang.flag}</span>
                                    {lang.label}
                                </span>
                                {language === lang.code && <Check size={14}/>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button className="relative text-slate-400 hover:text-slate-600 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-800">Alex Bennett</div>
                <div className="text-xs text-slate-500">Senior Manager</div>
              </div>
              <UserCircle size={36} className="text-slate-300" />
            </div>
          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
};
