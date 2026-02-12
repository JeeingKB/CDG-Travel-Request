
import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, PlusCircle, Settings, LogOut, Bell, UserCircle, List, Globe, ChevronDown, Check, User as UserIcon, Building, Phone } from 'lucide-react';
import { useTranslation, Language } from '../services/translations';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onNavigate: (view: any) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  const { t, language, setLanguage } = useTranslation();
  const { user, userRole, employeeDetails, signOut } = useAuth(); // Get auth data
  
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifyOpen, setIsNotifyOpen] = useState(false);

  const langMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifyMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setIsLangMenuOpen(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (notifyMenuRef.current && !notifyMenuRef.current.contains(event.target as Node)) setIsNotifyOpen(false);
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

  // --- Notification Logic ---
  const [notifications, setNotifications] = useState([
      { id: 1, title: 'Request Approved', desc: 'Your trip to Tokyo has been approved.', time: '2h ago', unread: true },
      { id: 2, title: 'Quotation Received', desc: 'Vendor sent 3 options for Singapore.', time: '5h ago', unread: true },
      { id: 3, title: 'System Update', desc: 'New policy regarding hotel limits updated.', time: '1d ago', unread: false },
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkAllRead = () => {
      setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleNotificationClick = (id: number) => {
      // Mark specific as read
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
      // Close dropdown
      setIsNotifyOpen(false);
      // Navigate to My Requests (assuming notifications are mostly about requests)
      onNavigate('MY_REQUESTS');
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {/* Sidebar - Hidden on Print */}
      <aside className="w-20 lg:w-72 bg-white border-r border-slate-100 flex flex-col fixed h-full z-20 transition-all duration-300 print:hidden shadow-sm">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0 shadow-md shadow-slate-300">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="font-bold text-lg text-slate-800 hidden lg:block tracking-tight">{t('app.title')}</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                ${activeView === item.id 
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-300' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <item.icon size={22} className={`relative z-10 ${activeView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
              <span className="font-medium hidden lg:block relative z-10">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Info */}
        <div className="p-6 border-t border-slate-100 hidden lg:block">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Current Role</div>
                <div className="font-bold text-slate-800 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${userRole === 'ADS' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                    {userRole}
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content - No Margin on Print */}
      <main className="flex-1 ml-20 lg:ml-72 transition-all duration-300 print:ml-0 print:w-full">
        {/* Top Header - Hidden on Print - Increased z-index to 40 */}
        <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 px-8 flex items-center justify-between print:hidden">
          <div className="text-sm text-slate-400 font-medium hidden sm:block">
            {new Date().toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          
          <div className="flex items-center gap-4 ml-auto sm:ml-0">
            
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

            {/* Notification Dropdown */}
            <div className="relative" ref={notifyMenuRef}>
                <button 
                    onClick={() => setIsNotifyOpen(!isNotifyOpen)}
                    className="relative text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                    )}
                </button>

                {isNotifyOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                        <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-sm text-slate-800">Notifications {unreadCount > 0 && `(${unreadCount})`}</h3>
                            <button onClick={handleMarkAllRead} className="text-xs text-blue-600 font-bold cursor-pointer hover:underline">Mark all read</button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => handleNotificationClick(n.id)}
                                        className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-3 transition-colors ${n.unread ? 'bg-blue-50/30' : ''}`}
                                    >
                                        <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${n.unread ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                        <div>
                                            <div className={`text-sm ${n.unread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</div>
                                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.desc}</div>
                                            <div className="text-[10px] text-slate-400 mt-1">{n.time}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-2 bg-slate-50 text-center">
                            <button onClick={() => { setIsNotifyOpen(false); onNavigate('MY_REQUESTS'); }} className="text-xs font-bold text-slate-600 hover:text-slate-900">View All</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative pl-6 border-l border-slate-100" ref={profileMenuRef}>
                <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-3 group focus:outline-none"
                >
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {employeeDetails?.name || user?.user_metadata?.full_name || 'User'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                            {userRole}
                        </div>
                    </div>
                    {user?.user_metadata?.avatar_url ? (
                        <img 
                            src={user.user_metadata.avatar_url} 
                            className={`w-9 h-9 rounded-full border-2 transition-colors ${isProfileOpen ? 'border-blue-500 shadow-md' : 'border-slate-200 group-hover:border-blue-300'}`} 
                            alt="Avatar"
                        />
                    ) : (
                        <UserCircle size={36} className="text-slate-300 group-hover:text-slate-400" />
                    )}
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                    <div className="absolute right-0 top-full mt-3 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                            <div className="font-bold text-slate-900">{employeeDetails?.name}</div>
                            <div className="text-xs text-slate-500">{user?.email}</div>
                        </div>
                        <div className="p-2 space-y-1">
                            <div className="px-3 py-2 text-xs text-slate-500 uppercase font-bold tracking-wider">Profile Info</div>
                            <div className="px-3 py-1.5 flex items-center gap-3 text-sm text-slate-700">
                                <Building size={16} className="text-slate-400"/>
                                <span>{employeeDetails?.department || 'N/A'}</span>
                            </div>
                            <div className="px-3 py-1.5 flex items-center gap-3 text-sm text-slate-700">
                                <UserIcon size={16} className="text-slate-400"/>
                                <span>{employeeDetails?.position || userRole}</span>
                            </div>
                            <div className="px-3 py-1.5 flex items-center gap-3 text-sm text-slate-700">
                                <Phone size={16} className="text-slate-400"/>
                                <span>{employeeDetails?.mobile || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="p-2 border-t border-slate-100">
                            <button 
                                onClick={() => { setIsProfileOpen(false); signOut(); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-bold"
                            >
                                <LogOut size={16} />
                                {t('sign_out')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

          </div>
        </header>
        
        {children}
      </main>
    </div>
  );
};
