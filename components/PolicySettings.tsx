
import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Shield, Server, Zap, Globe, Cpu, Users, Trash2, GitMerge, Check, X, Plane, Hotel, DollarSign, Activity, Database, Cloud, Wifi, AlertTriangle, Plus, Mail } from 'lucide-react';
import { storageService } from '../services/storage';
import { getSupabase, testSupabaseConnection } from '../services/supabaseClient'; // Import test function
import { TravelPolicy, SystemSettings, ApiProvider, Agency, FlightRule, HotelTier, AppFeature, DatabaseProvider } from '../types';
import { useTranslation } from '../services/translations';

// --- CONSTANTS FOR MODELS ---
const MODEL_OPTIONS: Record<ApiProvider | string, string[]> = {
    GEMINI: [
        'gemini-3-flash-preview',
        'gemini-3-pro-preview',
        'gemini-2.0-flash-exp'
    ],
    OPENAI: [
        'gpt-5-turbo-2026',
        'gpt-4o',
        'o1-preview-2026',
        'gpt-5-vision-preview'
    ],
    CUSTOM: [
        'llama-4-70b-2026',
        'mistral-large-2026',
        'deepseek-v4'
    ],
    MOCK: ['mock-response-v1']
};

export const PolicySettings: React.FC = () => {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<TravelPolicy | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]); 
  const [isSaved, setIsSaved] = useState(false);
  
  // Test Connection State
  const [testStatus, setTestStatus] = useState<'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [testMessage, setTestMessage] = useState('');

  // UI State
  const [mainTab, setMainTab] = useState<'RULES' | 'SYSTEM' | 'VENDORS'>('RULES');
  const [ruleTab, setRuleTab] = useState<'GENERAL' | 'FLIGHT' | 'HOTEL' | 'DOA'>('GENERAL');
  
  // Provider Config State
  const [selectedProviderToEdit, setSelectedProviderToEdit] = useState<ApiProvider>('GEMINI');

  useEffect(() => {
    const load = async () => {
        setPolicy(await storageService.getPolicies());
        setSettings(storageService.getSettings()); 
        setAgencies(await storageService.getAgencies());
    };
    load();
  }, []);

  const handleSave = async () => {
    if (policy && settings) {
      await storageService.savePolicies(policy);
      await storageService.saveAgencies(agencies);
      storageService.saveSettings(settings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleTestConnection = async () => {
      if (!settings?.databaseConfig.supabaseUrl || !settings?.databaseConfig.supabaseKey) {
          setTestStatus('ERROR');
          setTestMessage('Please enter URL and Key first.');
          return;
      }
      setTestStatus('TESTING');
      const result = await testSupabaseConnection(settings.databaseConfig.supabaseUrl, settings.databaseConfig.supabaseKey);
      setTestStatus(result.success ? 'SUCCESS' : 'ERROR');
      setTestMessage(result.message || 'Unknown error');
  };

  // --- Handlers for Complex Arrays ---
  const addFlightRule = () => {
      if (!policy) return;
      const newRule: FlightRule = { minDurationHours: 0, allowedCabin: 'Economy', applicableJobGrades: [] };
      setPolicy({ ...policy, flightRules: [...policy.flightRules, newRule] });
  };
  
  const removeFlightRule = (idx: number) => {
      if (!policy) return;
      const newRules = [...policy.flightRules];
      newRules.splice(idx, 1);
      setPolicy({ ...policy, flightRules: newRules });
  };

  const updateFlightRule = (idx: number, field: keyof FlightRule, value: any) => {
      if (!policy) return;
      const newRules = [...policy.flightRules];
      newRules[idx] = { ...newRules[idx], [field]: value };
      setPolicy({ ...policy, flightRules: newRules });
  };

  const addHotelTier = () => {
      if (!policy) return;
      const newTier: HotelTier = { zoneName: 'New Zone', cities: [], limitPerNight: 5000, currency: 'THB' };
      setPolicy({ ...policy, hotelTiers: [...policy.hotelTiers, newTier] });
  };

  const removeHotelTier = (idx: number) => {
      if (!policy) return;
      const newTiers = [...policy.hotelTiers];
      newTiers.splice(idx, 1);
      setPolicy({ ...policy, hotelTiers: newTiers });
  };

  const updateHotelTier = (idx: number, field: keyof HotelTier, value: any) => {
      if (!policy) return;
      const newTiers = [...policy.hotelTiers];
      newTiers[idx] = { ...newTiers[idx], [field]: value };
      setPolicy({ ...policy, hotelTiers: newTiers });
  };

  // --- Handlers for Vendors ---
  const addAgency = () => {
      const newAgency: Agency = {
          id: `AG-${Date.now()}`,
          name: 'New Agency',
          email: '',
          type: 'Full Service',
          isPreferred: false
      };
      setAgencies([...agencies, newAgency]);
  };

  const removeAgency = (id: string) => {
      setAgencies(agencies.filter(a => a.id !== id));
  };

  const updateAgency = (id: string, field: keyof Agency, value: any) => {
      setAgencies(agencies.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  // --- Handlers for System Config ---
  const handleConfigChange = (provider: 'gemini' | 'openai' | 'custom', field: string, value: string) => {
      if (!settings) return;
      setSettings({
          ...settings,
          apiConfigs: {
              ...settings.apiConfigs,
              [provider]: {
                  ...settings.apiConfigs[provider],
                  [field]: value
              }
          }
      });
  };

  const handleFeatureMappingChange = (feature: AppFeature, provider: ApiProvider) => {
      if (!settings) return;
      setSettings({
          ...settings,
          featureMapping: {
              ...settings.featureMapping,
              [feature]: provider
          }
      });
  };

  const handleDatabaseChange = (provider: DatabaseProvider) => {
      if (!settings) return;
      setSettings({ ...settings, databaseProvider: provider });
  };

  const handleSupabaseConfig = (field: 'supabaseUrl' | 'supabaseKey', value: string) => {
      if (!settings) return;
      // Reset test status when typing
      setTestStatus('IDLE');
      setSettings({
          ...settings,
          databaseConfig: {
              ...settings.databaseConfig,
              [field]: value
          }
      });
  };

  if (!policy || !settings) return <div>Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                <Shield className="text-blue-600" size={32} />
                {t('settings.title')}
            </h1>
            <p className="text-slate-500 mt-1">{t('settings.subtitle')}</p>
        </div>
        <button 
            onClick={handleSave}
            className={`px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 transition-all shadow-lg
               ${isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}`}
         >
            {isSaved ? t('settings.btn.saved') : t('settings.btn.save')}
            {isSaved ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
         </button>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 mb-6 w-fit">
          <button onClick={() => setMainTab('RULES')} className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${mainTab === 'RULES' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Shield size={16}/> {t('settings.tab.rules')}
          </button>
          <button onClick={() => setMainTab('SYSTEM')} className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${mainTab === 'SYSTEM' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Server size={16}/> {t('settings.tab.system')}
          </button>
          <button onClick={() => setMainTab('VENDORS')} className={`px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${mainTab === 'VENDORS' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Users size={16}/> {t('settings.tab.vendors')}
          </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 min-h-[600px] overflow-hidden">
         
         {/* === RULES TAB === */}
         {mainTab === 'RULES' && (
             <div className="flex flex-col md:flex-row h-full">
                 {/* Sidebar */}
                 <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-4 space-y-2">
                     <button onClick={() => setRuleTab('GENERAL')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 ${ruleTab === 'GENERAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                         <Globe size={18}/> {t('settings.subtab.general')}
                     </button>
                     <button onClick={() => setRuleTab('FLIGHT')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 ${ruleTab === 'FLIGHT' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                         <Plane size={18}/> {t('settings.subtab.flight')}
                     </button>
                     <button onClick={() => setRuleTab('HOTEL')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 ${ruleTab === 'HOTEL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                         <Hotel size={18}/> {t('settings.subtab.hotel')}
                     </button>
                     <button onClick={() => setRuleTab('DOA')} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 ${ruleTab === 'DOA' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                         <GitMerge size={18}/> {t('settings.subtab.doa')}
                     </button>
                 </div>

                 {/* Content */}
                 <div className="flex-1 p-8 overflow-y-auto max-h-[700px]">
                     
                     {/* 1. GENERAL */}
                     {ruleTab === 'GENERAL' && (
                         <div className="space-y-8 animate-fade-in">
                             <div>
                                 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Globe className="text-blue-500"/> {t('settings.sect.global')}</h3>
                                 <div className="grid grid-cols-2 gap-6">
                                     <div>
                                         <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('settings.lbl.mileage')}</label>
                                         <input type="number" value={policy.mileageRate} onChange={(e) => setPolicy({...policy, mileageRate: Number(e.target.value)})} className="w-full p-3 border rounded-xl font-bold"/>
                                     </div>
                                     <div>
                                         <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('settings.lbl.advBooking')}</label>
                                         <input type="number" value={policy.advanceBookingDays.international} onChange={(e) => setPolicy({...policy, advanceBookingDays: {...policy.advanceBookingDays, international: Number(e.target.value)}})} className="w-full p-3 border rounded-xl font-bold"/>
                                     </div>
                                 </div>
                             </div>
                             
                             <div>
                                 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><DollarSign className="text-green-500"/> {t('settings.sect.perDiem')}</h3>
                                 <div className="space-y-3">
                                     {policy.perDiem.map((pd, idx) => (
                                         <div key={idx} className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                                             <div className="flex-1 font-bold text-slate-700">{pd.region.replace('_', ' ')}</div>
                                             <div className="w-32">
                                                 <input type="number" value={pd.amount} onChange={(e) => {
                                                     const newPD = [...policy.perDiem];
                                                     newPD[idx].amount = Number(e.target.value);
                                                     setPolicy({...policy, perDiem: newPD});
                                                 }} className="w-full p-2 border rounded text-right font-mono"/>
                                             </div>
                                             <div className="w-20 font-bold text-slate-500">{pd.currency}</div>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* 2. FLIGHT */}
                     {ruleTab === 'FLIGHT' && (
                         <div className="space-y-6 animate-fade-in">
                             <div className="flex justify-between items-center">
                                 <h3 className="text-lg font-bold text-slate-800">{t('settings.sect.flightRules')}</h3>
                                 <button onClick={addFlightRule} className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100">{t('settings.btn.addRule')}</button>
                             </div>
                             <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                 {t('settings.desc.flight')}
                             </p>
                             <div className="space-y-4">
                                 {policy.flightRules.map((rule, idx) => (
                                     <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm relative group">
                                         <button onClick={() => removeFlightRule(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                             <div>
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase">{t('settings.lbl.minDuration')}</label>
                                                 <input type="number" value={rule.minDurationHours} onChange={(e) => updateFlightRule(idx, 'minDurationHours', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded border border-slate-200 mt-1"/>
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase">{t('settings.lbl.cabin')}</label>
                                                 <select value={rule.allowedCabin} onChange={(e) => updateFlightRule(idx, 'allowedCabin', e.target.value)} className="w-full p-2 bg-slate-50 rounded border border-slate-200 mt-1">
                                                     <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
                                                 </select>
                                             </div>
                                             <div>
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase">{t('settings.lbl.grades')}</label>
                                                 <input type="text" value={rule.applicableJobGrades.join(', ')} onChange={(e) => updateFlightRule(idx, 'applicableJobGrades', e.target.value.split(',').map((n: string) => parseInt(n.trim()) || 0))} className="w-full p-2 bg-slate-50 rounded border border-slate-200 mt-1"/>
                                             </div>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}

                     {/* 3. HOTEL */}
                     {ruleTab === 'HOTEL' && (
                         <div className="space-y-6 animate-fade-in">
                             <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl mb-6">
                                 <h4 className="font-bold text-orange-800 mb-2">{t('settings.sect.hotelDefault')}</h4>
                                 <div className="flex gap-6">
                                     <div className="flex-1">
                                         <label className="text-xs uppercase font-bold text-orange-600">{t('settings.lbl.domDefault')}</label>
                                         <input type="number" value={policy.defaultHotelLimit.domestic} onChange={(e) => setPolicy({...policy, defaultHotelLimit: {...policy.defaultHotelLimit, domestic: Number(e.target.value)}})} className="w-full p-2 mt-1 rounded border-orange-200 border"/>
                                     </div>
                                     <div className="flex-1">
                                         <label className="text-xs uppercase font-bold text-orange-600">{t('settings.lbl.intlDefault')}</label>
                                         <input type="number" value={policy.defaultHotelLimit.international} onChange={(e) => setPolicy({...policy, defaultHotelLimit: {...policy.defaultHotelLimit, international: Number(e.target.value)}})} className="w-full p-2 mt-1 rounded border-orange-200 border"/>
                                     </div>
                                 </div>
                             </div>

                             <div className="flex justify-between items-center">
                                 <h3 className="text-lg font-bold text-slate-800">{t('settings.sect.zones')}</h3>
                                 <button onClick={addHotelTier} className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100">{t('settings.btn.addZone')}</button>
                             </div>
                             
                             {policy.hotelTiers.map((tier, idx) => (
                                 <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm relative group">
                                     <button onClick={() => removeHotelTier(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                     <div className="mb-3">
                                         <input type="text" value={tier.zoneName} onChange={(e) => updateHotelTier(idx, 'zoneName', e.target.value)} className="font-bold text-slate-800 w-full border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none" placeholder={t('settings.lbl.zoneName')}/>
                                     </div>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <div>
                                             <label className="text-[10px] font-bold text-slate-400 uppercase">{t('settings.lbl.cities')}</label>
                                             <textarea rows={2} value={tier.cities.join(', ')} onChange={(e) => updateHotelTier(idx, 'cities', e.target.value.split(',').map((s: string) => s.trim()))} className="w-full p-2 bg-slate-50 rounded border border-slate-200 mt-1 text-sm"/>
                                         </div>
                                         <div className="flex gap-2">
                                             <div className="flex-1">
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase">{t('settings.lbl.limit')}</label>
                                                 <input type="number" value={tier.limitPerNight} onChange={(e) => updateHotelTier(idx, 'limitPerNight', Number(e.target.value))} className="w-full p-2 bg-slate-50 rounded border border-slate-200 mt-1 font-bold"/>
                                             </div>
                                             <div className="w-24">
                                                 <label className="text-[10px] font-bold text-slate-400 uppercase">{t('settings.lbl.currency')}</label>
                                                 <select value={tier.currency} onChange={(e) => updateHotelTier(idx, 'currency', e.target.value)} className="w-full p-2 bg-slate-50 rounded border border-slate-200 mt-1">
                                                     <option>THB</option><option>USD</option><option>EUR</option>
                                                 </select>
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}

                     {/* 4. DOA */}
                     {ruleTab === 'DOA' && (
                        <div className="space-y-6 animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><GitMerge className="text-purple-500"/> {t('settings.sect.doa')}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-semibold text-slate-500 uppercase block">{t('settings.lbl.deptHead')}</label>
                                        <span className="text-[10px] text-slate-400">{t('settings.desc.deptHead')}</span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-500 font-bold">฿</span>
                                        <input 
                                            type="number" 
                                            value={policy.doa?.departmentHeadThreshold || 0} 
                                            onChange={e => setPolicy({...policy, doa: {...policy.doa, departmentHeadThreshold: parseInt(e.target.value)}})}
                                            className="w-full pl-8 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-sm font-semibold text-slate-500 uppercase block">{t('settings.lbl.exec')}</label>
                                        <span className="text-[10px] text-slate-400">{t('settings.desc.exec')}</span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-3 text-slate-500 font-bold">฿</span>
                                        <input 
                                            type="number" 
                                            value={policy.doa?.executiveThreshold || 0} 
                                            onChange={e => setPolicy({...policy, doa: {...policy.doa, executiveThreshold: parseInt(e.target.value)}})}
                                            className="w-full pl-8 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                     )}
                 </div>
             </div>
         )}

         {/* === SYSTEM TAB (REFACTORED) === */}
         {mainTab === 'SYSTEM' && (
             <div className="p-8 space-y-8 overflow-y-auto max-h-[700px]">
                
                {/* 0. DATABASE CONFIGURATION (NEW) */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Database className="text-slate-600"/> Database Provider
                    </h3>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <div className="flex gap-3 mb-4">
                            <button onClick={() => handleDatabaseChange('LOCAL_STORAGE')} className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${settings.databaseProvider === 'LOCAL_STORAGE' ? 'bg-white border-2 border-slate-900 shadow-md text-slate-900' : 'bg-slate-200/50 text-slate-500'}`}>
                                <Activity size={16}/> Local Storage (Demo)
                            </button>
                            <button onClick={() => handleDatabaseChange('SUPABASE')} className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${settings.databaseProvider === 'SUPABASE' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-200/50 text-slate-500'}`}>
                                <Cloud size={16}/> Supabase (Cloud)
                            </button>
                        </div>

                        {settings.databaseProvider === 'SUPABASE' && (
                            <div className="grid grid-cols-1 gap-4 animate-fade-in">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Supabase URL</label>
                                    <input type="text" value={settings.databaseConfig.supabaseUrl || ''} onChange={(e) => handleSupabaseConfig('supabaseUrl', e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Supabase Anon Key</label>
                                    <input type="password" value={settings.databaseConfig.supabaseKey || ''} onChange={(e) => handleSupabaseConfig('supabaseKey', e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"/>
                                </div>
                                
                                {/* TEST CONNECTION BUTTON */}
                                <div className="flex items-center gap-3 mt-2">
                                    <button 
                                        onClick={handleTestConnection}
                                        disabled={testStatus === 'TESTING'}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all 
                                            ${testStatus === 'SUCCESS' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 
                                              testStatus === 'ERROR' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 
                                              'bg-slate-900 text-white hover:bg-slate-800'}`}
                                    >
                                        {testStatus === 'TESTING' ? <RefreshCw className="animate-spin" size={16}/> : <Wifi size={16}/>}
                                        {testStatus === 'TESTING' ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    {testStatus === 'SUCCESS' && <span className="text-sm font-bold text-green-600 flex items-center gap-1"><Check size={16}/> Connected!</span>}
                                    {testStatus === 'ERROR' && <span className="text-sm font-bold text-red-600 flex items-center gap-1"><AlertTriangle size={16}/> {testMessage}</span>}
                                </div>

                                <div className="text-xs text-slate-400 mt-2 bg-yellow-50 p-2 rounded border border-yellow-100 text-yellow-700">
                                    <strong>Note:</strong> You must create tables in Supabase SQL Editor first. See documentation.
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* 1. PROVIDER CONFIGURATION */}
                <section>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Cpu className="text-slate-600"/> {t('settings.sect.ai')}
                    </h3>
                    
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        {/* Provider Selector */}
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('settings.lbl.providerSelect')}</label>
                            <div className="flex gap-2">
                                {[{ id: 'GEMINI', icon: Zap, label: 'Gemini' }, { id: 'OPENAI', icon: Globe, label: 'OpenAI' }, { id: 'CUSTOM', icon: Server, label: 'Custom' }, { id: 'MOCK', icon: Activity, label: 'Mock' }].map((p) => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => setSelectedProviderToEdit(p.id as ApiProvider)} 
                                        className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all
                                        ${selectedProviderToEdit === p.id ? 'bg-white border-2 border-slate-900 shadow-md text-slate-900' : 'bg-slate-200/50 text-slate-500 hover:bg-white hover:shadow-sm'}`}
                                    >
                                        <p.icon size={16}/> {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Config Fields */}
                        {selectedProviderToEdit !== 'MOCK' && (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('settings.lbl.apiKey')}</label>
                                    <input 
                                        type="password" 
                                        value={selectedProviderToEdit === 'GEMINI' ? settings.apiConfigs.gemini.apiKey : selectedProviderToEdit === 'OPENAI' ? settings.apiConfigs.openai.apiKey : settings.apiConfigs.custom.apiKey} 
                                        onChange={(e) => handleConfigChange(selectedProviderToEdit.toLowerCase() as any, 'apiKey', e.target.value)} 
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                        placeholder="sk-..."
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t('settings.lbl.model')}</label>
                                    <select 
                                        value={selectedProviderToEdit === 'GEMINI' ? settings.apiConfigs.gemini.model : selectedProviderToEdit === 'OPENAI' ? settings.apiConfigs.openai.model : settings.apiConfigs.custom.model} 
                                        onChange={(e) => handleConfigChange(selectedProviderToEdit.toLowerCase() as any, 'model', e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none appearance-none"
                                    >
                                        {MODEL_OPTIONS[selectedProviderToEdit]?.map(model => (
                                            <option key={model} value={model}>{model}</option>
                                        ))}
                                    </select>
                                </div>
                                {selectedProviderToEdit === 'CUSTOM' && (
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Endpoint URL</label>
                                        <input 
                                            type="text" 
                                            value={settings.apiConfigs.custom.endpoint}
                                            onChange={(e) => handleConfigChange('custom', 'endpoint', e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                        />
                                    </div>
                                )}
                             </div>
                        )}
                        {selectedProviderToEdit === 'MOCK' && (
                            <div className="text-center py-4 text-slate-400 bg-slate-100 rounded-xl border border-dashed border-slate-300">
                                Mock Mode is active. No configuration required.
                            </div>
                        )}
                    </div>
                </section>

                {/* 2. FEATURE MAPPING */}
                <section>
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GitMerge className="text-purple-600"/> {t('settings.sect.features')}</h3>
                        <p className="text-sm text-slate-500">{t('settings.desc.features')}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {Object.entries(settings.featureMapping).map(([feature, provider]) => (
                            <div key={feature} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${feature === 'CHAT' ? 'bg-blue-100 text-blue-600' : feature === 'OCR' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {feature === 'CHAT' ? <Users size={18}/> : feature === 'OCR' ? <Plane size={18}/> : feature === 'POLICY' ? <Shield size={18}/> : <Activity size={18}/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">{feature}</div>
                                        <div className="text-xs text-slate-400 font-medium tracking-wide">APP FEATURE</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-bold uppercase mr-2">Powered By</span>
                                    <select 
                                        value={provider} 
                                        onChange={(e) => handleFeatureMappingChange(feature as AppFeature, e.target.value as ApiProvider)}
                                        className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        <option value="GEMINI">Gemini</option>
                                        <option value="OPENAI">OpenAI</option>
                                        <option value="CUSTOM">Custom</option>
                                        <option value="MOCK">Mock</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

             </div>
         )}
         
         {/* === VENDORS TAB (Updated with CRUD) === */}
         {mainTab === 'VENDORS' && (
             <div className="p-8">
                 <div className="flex justify-between items-center mb-6">
                     <div>
                         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                             <Users className="text-blue-500"/> {t('settings.tab.vendors')}
                         </h3>
                         <p className="text-sm text-slate-500">Manage external travel agencies and preferred partners.</p>
                     </div>
                     <button onClick={addAgency} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors">
                         <Plus size={16}/> Add Vendor
                     </button>
                 </div>

                 <div className="space-y-4 animate-fade-in">
                        {agencies.length === 0 && (
                            <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                No vendors configured. Add one to get started.
                            </div>
                        )}
                        {agencies.map((agency) => (
                            <div key={agency.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4 group relative">
                                <button onClick={() => removeAgency(agency.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pr-8">
                                     <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Agency Name</label>
                                         <input 
                                            type="text" 
                                            value={agency.name} 
                                            onChange={(e) => updateAgency(agency.id, 'name', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Agency Name"
                                         />
                                     </div>
                                     <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Email (for RFQ)</label>
                                         <div className="relative">
                                             <Mail size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                                             <input 
                                                type="email" 
                                                value={agency.email} 
                                                onChange={(e) => updateAgency(agency.id, 'email', e.target.value)}
                                                className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="email@example.com"
                                             />
                                         </div>
                                     </div>
                                     <div>
                                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                                          <select 
                                            value={agency.type} 
                                            onChange={(e) => updateAgency(agency.id, 'type', e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                          >
                                              <option>Full Service</option>
                                              <option>Low Cost</option>
                                              <option>Hotel Specialist</option>
                                              <option>Car Rental</option>
                                          </select>
                                     </div>
                                     <div className="flex items-end">
                                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 w-full border border-transparent hover:border-slate-200 transition-colors">
                                              <input 
                                                type="checkbox" 
                                                checked={agency.isPreferred} 
                                                onChange={(e) => updateAgency(agency.id, 'isPreferred', e.target.checked)}
                                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                                              />
                                              <span className="text-sm font-semibold text-slate-700">Preferred Vendor</span>
                                          </label>
                                     </div>
                                </div>
                            </div>
                        ))}
                    </div>
             </div>
         )}

      </div>
    </div>
  );
};
