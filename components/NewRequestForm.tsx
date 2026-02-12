
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, User, Users, Briefcase, MapPin, 
  CalendarDays, CreditCard, Sparkles, Check, AlertCircle, 
  ChevronRight, Loader2, Building, Plus, Trash2, Info,
  Plane, Hotel, Car, Shield, Ticket, Calculator, GitMerge, Languages, Wand2
} from 'lucide-react';
import { TravelRequest, RequestFor, TravelType, TravelPolicy } from '../types';
import { generateJustification } from '../services/geminiService';
import { validatePolicy, calculateMileageReimbursement, getDailyPerDiem, getHotelLimit, getApprovalFlow } from '../services/policyRules';
import { storageService } from '../services/storage';
import { AIRPORTS, CITIES, AIRLINES } from '../services/mockData';
import { SearchableSelect } from './ui/SearchableSelect';
import { useTravelRequestForm } from '../hooks/useTravelRequestForm';
import { useTranslation } from '../services/translations';
import { useAiTranslation } from '../hooks/useAiTranslation';

interface NewRequestFormProps {
  initialData?: Partial<TravelRequest> | null;
  onCancel: () => void;
  onSubmit: (request: TravelRequest) => void;
}

const STEPS = ['form.step.travelers', 'form.step.trip', 'form.step.services', 'form.step.review'];

export const NewRequestForm: React.FC<NewRequestFormProps> = ({ initialData, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const { translate, isLoading: isTranslating } = useAiTranslation();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [policyFeedback, setPolicyFeedback] = useState<{ compliant: boolean; message: string, flags: string[] } | null>(null);
  const [approvalFlow, setApprovalFlow] = useState<string[]>([]);
  const [currentPolicy, setCurrentPolicy] = useState<TravelPolicy | undefined>(undefined);

  // Dynamic Data State
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [availableCostCenters, setAvailableCostCenters] = useState<any[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<{value: string, label: string, subLabel: string}[]>([]);

  // Use Custom Hook for Logic
  const {
      requestFor, setRequestFor,
      travelType, setTravelType,
      travelers, addTraveler, updateTraveler, removeTraveler, selectEmployeeTraveler,
      trip, setTrip, handleTripChange,
      services, addService, removeService, updateService,
      estimatedCost, setEstimatedCost,
      calculateDays, buildRequestObject
  } = useTravelRequestForm(initialData);

  const isEditMode = !!(initialData && initialData.id);

  // Load Master Data (Projects, Employees, Policies)
  useEffect(() => {
    const loadMasterData = async () => {
        const [projs, ccs, pols, emps] = await Promise.all([
            storageService.getProjects(),
            storageService.getCostCenters(),
            storageService.getPolicies(),
            storageService.getEmployees()
        ]);
        
        setAvailableProjects(projs);
        setAvailableCostCenters(ccs);
        setCurrentPolicy(pols);
        
        // Transform Employees for Select
        setEmployeeOptions(emps.map(e => ({
            value: e.id,
            label: e.name,
            subLabel: `${e.department || 'General'} • ${e.email}`
        })));
    };
    loadMasterData();
  }, []);

  // --- AI Handlers ---

  const handleAIJustification = async () => {
    if (!trip.destination || !trip.purpose) return;
    setIsGenerating(true);
    try {
        const text = await generateJustification(trip.destination, trip.purpose, calculateDays(), travelType);
        setTrip(prev => ({ ...prev, justification: text }));
    } catch(e) {
        console.error("AI Generation failed");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleTranslatePurpose = async () => {
      if (!trip.purpose) return;
      const translated = await translate(trip.purpose, 'en');
      setTrip(prev => ({ ...prev, purpose: translated }));
  };

  const handleTranslateJustification = async () => {
      if (!trip.justification) return;
      const translated = await translate(trip.justification, 'en');
      setTrip(prev => ({ ...prev, justification: translated }));
  };

  // Real-time Policy & DOA Check using Rule Engine
  useEffect(() => {
      const runValidation = () => {
          let allFlags: string[] = [];
          
          // Check Flight & Hotel Rules for primary traveler
          const mainTraveler = travelers[0];
          
          // Iterate services to find conflicts
          services.forEach(svc => {
              if (svc.type === 'FLIGHT') {
                  const msg = validatePolicy(travelType, trip.destination, mainTraveler, svc as any)[0];
                  if (msg) allFlags.push(msg);
              }
              if (svc.type === 'CAR') {
                  const car = svc as any;
                  if (car.carType === 'Personal Car (Mileage)' && car.mileageDistance) {
                      if (car.mileageDistance > 800) allFlags.push("Mileage > 800km. Please consider flight.");
                  }
              }
          });

          // Aggregate Cost Check
          const days = calculateDays();
          const hotelLimit = getHotelLimit(trip.destination, travelType);
          const perDiem = getDailyPerDiem(mainTraveler, travelType, trip.destination).amount;
          const maxBudget = (hotelLimit + (travelType === 'INTERNATIONAL' ? perDiem * 34 : perDiem)) * days * travelers.length + 20000; 
          
          if (estimatedCost > maxBudget && estimatedCost > 0) {
              allFlags.push(`Total cost exceeds typical allowances (Max approx ฿${maxBudget.toLocaleString()}).`);
          }

          if (allFlags.length > 0) {
              setPolicyFeedback({ compliant: false, message: t('form.policy.warning'), flags: allFlags });
          } else {
              setPolicyFeedback({ compliant: true, message: t('form.policy.compliant'), flags: [] });
          }

          // CALCULATE DOA (Approval Flow)
          const flow = getApprovalFlow(mainTraveler, estimatedCost, currentPolicy);
          setApprovalFlow(flow);
      };

      runValidation();
  }, [services, trip, travelers, estimatedCost, travelType, currentPolicy, t]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const request = buildRequestObject(initialData?.status, policyFeedback?.flags);
    onSubmit(request);
  };

  // Options (Airports/Cities still use static ref data for UX speed)
  const airportOptions = AIRPORTS.map(a => ({ value: a.code, label: `${a.code} - ${a.name}`, subLabel: a.city }));
  const cityOptions = CITIES.map(c => ({ value: c, label: c }));
  const projectOptions = availableProjects.map(p => ({ value: p.code, label: p.code, subLabel: p.name }));
  const airlineOptions = AIRLINES.map(a => ({ value: a, label: a }));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in-up pb-32">
       <button onClick={onCancel} className="flex items-center text-slate-500 hover:text-slate-800 mb-6 transition-colors group">
        <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
        {t('form.cancel')}
      </button>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-8 px-4 md:px-12 relative">
        {STEPS.map((step, index) => (
          <div key={step} className="flex flex-col items-center relative z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ring-4 ring-white
              ${index <= currentStep ? 'bg-slate-900 text-white shadow-lg scale-110' : 'bg-slate-200 text-slate-500'}`}>
              {index + 1}
            </div>
            <span className={`mt-2 text-[10px] md:text-xs font-semibold uppercase tracking-wide ${index <= currentStep ? 'text-slate-900' : 'text-slate-300'}`}>
              {t(step)}
            </span>
          </div>
        ))}
        <div className="absolute top-[18px] left-0 w-full h-0.5 bg-slate-100 -z-0 max-w-5xl mx-auto px-12">
           <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}></div>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 min-h-[600px] flex flex-col relative z-0">
        <div className="flex-1 p-6 md:p-10">
          
          {/* STEP 1: REQUESTER & TRAVELERS */}
          {currentStep === 0 && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6">
                 <div className="flex-1">
                    <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('form.whoTraveling')}</h2>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: RequestFor.SELF, label: t('common.self'), icon: User },
                        { id: RequestFor.EMPLOYEE, label: t('common.employee'), icon: Users },
                        { id: RequestFor.CLIENT, label: t('common.client'), icon: Briefcase },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setRequestFor(opt.id)}
                          className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all
                            ${requestFor === opt.id ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                          <opt.icon className={requestFor === opt.id ? 'text-blue-600' : 'text-slate-400'} size={20} />
                          <span className="text-xs font-bold text-center">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                 </div>
                 <div className="flex-1">
                    <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('form.travelType')}</h2>
                     <div className="flex gap-3 h-[76px]">
                         {[
                             { id: TravelType.DOMESTIC, label: t('common.domestic') + " 🇹🇭" },
                             { id: TravelType.INTERNATIONAL, label: t('common.international') + " 🌍" }
                         ].map(t => (
                             <button
                                 key={t.id}
                                 onClick={() => setTravelType(t.id)}
                                 className={`flex-1 rounded-xl border-2 font-bold text-sm transition-all
                                 ${travelType === t.id ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                             >
                                 {t.label}
                             </button>
                         ))}
                     </div>
                 </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex justify-between items-center">
                   {t('form.step.travelers')} ({travelers.length})
                   <button onClick={addTraveler} className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 flex items-center gap-1 shadow-md">
                       <Plus size={14}/> {t('form.addPerson')}
                   </button>
                </h2>
                
                <div className="space-y-4">
                  {travelers.map((traveler, idx) => (
                    <div key={idx} className="p-5 border border-slate-200 rounded-xl bg-slate-50 relative animate-fade-in">
                      {travelers.length > 1 && (
                         <div className="absolute -left-3 top-6 bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md">{idx + 1}</div>
                      )}
                      {travelers.length > 1 && (
                         <button onClick={() => removeTraveler(idx)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                                {traveler.type === 'Employee' ? t('form.label.dept') : t('form.label.company')}
                             </label>
                             {traveler.type === 'Employee' ? (
                                 <input 
                                     type="text" 
                                     value={traveler.department || ''} 
                                     readOnly 
                                     className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600"
                                     placeholder={t('form.label.dept')}
                                 />
                             ) : (
                                 <input 
                                     type="text" 
                                     value={traveler.company || ''} 
                                     onChange={(e) => updateTraveler(idx, 'company', e.target.value)}
                                     className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                     placeholder={t('form.label.company')}
                                 />
                             )}
                        </div>

                        {traveler.type === 'Employee' && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.empId')}</label>
                                <input 
                                    type="text" 
                                    value={traveler.id.startsWith('NEW') || traveler.id.startsWith('AI-PAX') || traveler.id.startsWith('IMP') ? '' : traveler.id} 
                                    readOnly 
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600"
                                    placeholder="ID"
                                />
                            </div>
                        )}

                        <div className={`sm:col-span-2 ${traveler.type === 'Employee' ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.fullName')}</label>
                            {requestFor === RequestFor.EMPLOYEE && traveler.type === 'Employee' ? (
                                <SearchableSelect 
                                    options={employeeOptions}
                                    value={traveler.id.startsWith('NEW') || traveler.id.startsWith('AI-PAX') || traveler.id.startsWith('IMP') ? '' : traveler.id}
                                    onChange={(val) => selectEmployeeTraveler(idx, val)}
                                    placeholder="Search by ID, Name..."
                                />
                            ) : (
                                <input 
                                    type="text" 
                                    value={traveler.name}
                                    onChange={(e) => updateTraveler(idx, 'name', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                    placeholder={t('form.label.fullName')}
                                    disabled={requestFor === RequestFor.SELF}
                                />
                            )}
                        </div>

                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.mobile')}</label>
                             <input 
                                 type="text" 
                                 value={traveler.mobile || ''} 
                                 onChange={(e) => updateTraveler(idx, 'mobile', e.target.value)}
                                 className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                 placeholder="0xx-xxx-xxxx"
                             />
                        </div>

                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.email')}</label>
                             <input 
                                 type="email" 
                                 value={traveler.email || ''} 
                                 onChange={(e) => updateTraveler(idx, 'email', e.target.value)}
                                 className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                 placeholder="email@example.com"
                             />
                        </div>
                        
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.dob')}</label>
                            <input 
                                type="date"
                                value={traveler.dateOfBirth || ''}
                                onChange={(e) => updateTraveler(idx, 'dateOfBirth', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                      </div>

                      {travelType === TravelType.INTERNATIONAL && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200 border-dashed">
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.passport')}</label>
                                <input 
                                    type="text" value={traveler.passportNumber || ''}
                                    onChange={(e) => updateTraveler(idx, 'passportNumber', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                    placeholder="X1234567"
                                />
                             </div>
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.passportExpiry')}</label>
                                <input 
                                    type="date" value={traveler.passportExpiry || ''}
                                    onChange={(e) => updateTraveler(idx, 'passportExpiry', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                />
                             </div>
                          </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TRIP INFO */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('form.label.origin')}</label>
                    <SearchableSelect 
                        options={[...airportOptions, ...cityOptions]}
                        value={trip.origin}
                        onChange={(val) => setTrip(prev => ({...prev, origin: val}))}
                        placeholder="Select Origin..."
                        icon={MapPin}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('form.label.dest')}</label>
                    <SearchableSelect 
                        options={[...airportOptions, ...cityOptions]}
                        value={trip.destination}
                        onChange={(val) => setTrip(prev => ({...prev, destination: val}))}
                        placeholder="Select Destination..."
                        icon={MapPin}
                        className="w-full"
                    />
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">{t('form.label.start')}</label>
                   <div className="relative">
                      <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                      <input type="date" name="startDate" value={trip.startDate} onChange={(e) => handleTripChange('startDate', e.target.value)} className="w-full pl-10 px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-bold text-slate-700 mb-1">{t('form.label.end')}</label>
                   <div className="relative">
                      <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                      <input type="date" name="endDate" value={trip.endDate} onChange={(e) => handleTripChange('endDate', e.target.value)} className="w-full pl-10 px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none" />
                   </div>
                 </div>
              </div>

              {/* Purpose & Justification */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                      <Wand2 size={120}/>
                  </div>

                  <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-700">{t('form.label.purpose')}</label>
                        <button type="button" onClick={handleTranslatePurpose} disabled={isTranslating || !trip.purpose} className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 flex items-center gap-1 transition-colors">
                            {isTranslating ? <Loader2 className="animate-spin" size={12}/> : <Languages size={12} />} 
                            Translate to English
                        </button>
                      </div>
                      <input name="purpose" value={trip.purpose} onChange={(e) => handleTripChange('purpose', e.target.value)} placeholder="e.g., Annual Client Summit, Project Kickoff (Thai/Eng allowed)" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none bg-white/80 backdrop-blur-sm" />
                  </div>

                  <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-bold text-slate-700">Detailed Justification</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={handleTranslateJustification} disabled={isTranslating || !trip.justification} className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 flex items-center gap-1 transition-colors">
                                {isTranslating ? <Loader2 className="animate-spin" size={12}/> : <Languages size={12} />} 
                                Translate (AI)
                            </button>
                            <button type="button" onClick={handleAIJustification} disabled={isGenerating || !trip.destination} className="text-xs px-2 py-1 rounded-md bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 flex items-center gap-1 transition-colors">
                                {isGenerating ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12} />} 
                                {t('form.btn.aiJustification')}
                            </button>
                        </div>
                      </div>
                      <textarea name="justification" value={trip.justification} onChange={(e) => handleTripChange('justification', e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none bg-white/80 backdrop-blur-sm" placeholder="Explain why this trip is necessary. You can type in Thai, we will translate it!" />
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Info size={10}/> Tip: You can type loosely or use slang; AI will formalize it for the approval record.</p>
                  </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
             <div className="space-y-8 animate-fade-in">
                <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 justify-center">
                   <span className="w-full text-center text-xs font-bold text-slate-400 uppercase mb-1">Add Services</span>
                   <button onClick={() => addService('FLIGHT')} className="service-btn bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"><Plane size={16}/> Flight</button>
                   <button onClick={() => addService('HOTEL')} className="service-btn bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"><Hotel size={16}/> Hotel</button>
                   <button onClick={() => addService('CAR')} className="service-btn bg-green-50 text-green-700 border-green-200 hover:bg-green-100"><Car size={16}/> Car Rental</button>
                   <button onClick={() => addService('INSURANCE')} className="service-btn bg-red-50 text-red-700 border-red-200 hover:bg-red-100"><Shield size={16}/> Insurance</button>
                   <button onClick={() => addService('EVENT')} className="service-btn bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"><Ticket size={16}/> Event Pass</button>
                </div>

                <div className="space-y-6">
                   {services.map((svc) => (
                      <div key={svc.id} className="border border-slate-200 rounded-xl shadow-sm animate-fade-in group bg-white">
                         <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center rounded-t-xl">
                             <div className="flex items-center gap-2 font-bold text-slate-700">
                                {svc.type === 'FLIGHT' && <Plane size={18} className="text-blue-500"/>}
                                {svc.type === 'HOTEL' && <Hotel size={18} className="text-orange-500"/>}
                                {svc.type === 'CAR' && <Car size={18} className="text-green-500"/>}
                                {svc.type === 'INSURANCE' && <Shield size={18} className="text-red-500"/>}
                                {svc.type === 'EVENT' && <Ticket size={18} className="text-purple-500"/>}
                                <span>{svc.type} Request</span>
                             </div>
                             <button onClick={() => removeService(svc.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                         </div>

                         <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                             {svc.type === 'FLIGHT' && (
                                <>
                                  <div className="md:col-span-2 flex gap-4">
                                      {['ROUND_TRIP', 'ONE_WAY'].map(t => (
                                          <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                                              <input type="radio" checked={(svc as any).tripType === t} onChange={() => updateService(svc.id, 'tripType', t)} />
                                              {t.replace('_', ' ')}
                                          </label>
                                      ))}
                                  </div>
                                  <div>
                                      <label className="label-sm">From</label>
                                      <SearchableSelect options={airportOptions} value={(svc as any).from} onChange={(v) => updateService(svc.id, 'from', v)} placeholder="Origin Airport" />
                                  </div>
                                  <div>
                                      <label className="label-sm">To</label>
                                      <SearchableSelect options={airportOptions} value={(svc as any).to} onChange={(v) => updateService(svc.id, 'to', v)} placeholder="Dest Airport" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                      <div>
                                          <label className="label-sm">Depart Date</label>
                                          <input type="date" value={(svc as any).departureDate} onChange={e => updateService(svc.id, 'departureDate', e.target.value)} className="input-field"/>
                                      </div>
                                      <div>
                                          <label className="label-sm">Time Pref</label>
                                          <select className="input-field" onChange={e => updateService(svc.id, 'departureTimeSlot', e.target.value)}>
                                              <option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option><option value="EVENING">Evening</option>
                                          </select>
                                      </div>
                                  </div>
                                  {(svc as any).tripType === 'ROUND_TRIP' && (
                                      <div className="grid grid-cols-2 gap-2">
                                          <div>
                                              <label className="label-sm">Return Date</label>
                                              <input type="date" value={(svc as any).returnDate} onChange={e => updateService(svc.id, 'returnDate', e.target.value)} className="input-field"/>
                                          </div>
                                      </div>
                                  )}
                                  <div>
                                      <label className="label-sm">Class</label>
                                      <select value={(svc as any).flightClass} onChange={e => updateService(svc.id, 'flightClass', e.target.value)} className="input-field">
                                          <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="label-sm">Airline Preference</label>
                                      <SearchableSelect options={airlineOptions} value={(svc as any).airlinePreference} onChange={v => updateService(svc.id, 'airlinePreference', v)} placeholder="Any Airline" />
                                  </div>
                                </>
                             )}

                             {svc.type === 'HOTEL' && (
                                <>
                                   <div className="md:col-span-2">
                                       <label className="label-sm">Area / City / Hotel Name</label>
                                       <SearchableSelect options={cityOptions} value={(svc as any).location} onChange={v => updateService(svc.id, 'location', v)} placeholder="Search Location..." />
                                   </div>
                                   <div className="flex gap-2">
                                       <div className="flex-1">
                                           <label className="label-sm">Check-in</label>
                                           <input type="date" value={(svc as any).checkIn} onChange={e => updateService(svc.id, 'checkIn', e.target.value)} className="input-field"/>
                                       </div>
                                       <div className="flex-1">
                                           <label className="label-sm">Check-out</label>
                                           <input type="date" value={(svc as any).checkOut} onChange={e => updateService(svc.id, 'checkOut', e.target.value)} className="input-field"/>
                                       </div>
                                   </div>
                                </>
                             )}

                             {svc.type === 'CAR' && (
                                <>
                                  <div className="md:col-span-2">
                                      <label className="label-sm">Car Type</label>
                                      <select className="input-field" value={(svc as any).carType} onChange={e => updateService(svc.id, 'carType', e.target.value)}>
                                          <option value="Sedan">Sedan (Rental)</option>
                                          <option value="SUV">SUV (Rental)</option>
                                          <option value="Van">Van (Rental)</option>
                                          <option value="Personal Car (Mileage)">Personal Car (Mileage Claim)</option>
                                      </select>
                                  </div>
                                  {(svc as any).carType === 'Personal Car (Mileage)' ? (
                                      <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                          <label className="label-sm">Total Distance (KM)</label>
                                          <input 
                                              type="number" 
                                              placeholder="e.g. 150"
                                              className="input-field font-bold"
                                              value={(svc as any).mileageDistance || ''}
                                              onChange={e => updateService(svc.id, 'mileageDistance', parseFloat(e.target.value))}
                                          />
                                          {(svc as any).mileageDistance > 0 && (
                                              <div className="mt-2 text-sm text-green-700 font-bold flex items-center gap-2">
                                                  <Calculator size={14}/>
                                                  Reimbursement: ฿ {calculateMileageReimbursement((svc as any).mileageDistance).toLocaleString()}
                                              </div>
                                          )}
                                      </div>
                                  ) : (
                                      <div className="md:col-span-2">
                                          <label className="label-sm">Pickup/Dropoff Location</label>
                                          <input type="text" className="input-field" placeholder="e.g. Airport" value={(svc as any).pickupLocation} onChange={e => updateService(svc.id, 'pickupLocation', e.target.value)}/>
                                      </div>
                                  )}
                                </>
                             )}
                             
                             {(svc.type === 'INSURANCE' || svc.type === 'EVENT') && (
                                 <div className="md:col-span-2">
                                    <textarea placeholder="Additional Notes..." className="input-field mt-2" rows={2} onChange={e => updateService(svc.id, 'notes', e.target.value)}></textarea>
                                 </div>
                             )}
                         </div>
                      </div>
                   ))}
                   {services.length === 0 && <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">No services added yet. Please select a service type above.</div>}
                </div>
             </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('form.label.project')} <span className="text-red-500">*</span></label>
                      <SearchableSelect 
                         options={projectOptions}
                         value={trip.projectCode}
                         onChange={(v) => setTrip(prev => ({...prev, projectCode: v}))}
                         placeholder="Select Project..."
                         icon={Building}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('form.label.costCenter')}</label>
                      <select name="costCenter" value={trip.costCenter} onChange={(e) => handleTripChange('costCenter', e.target.value)}
                        className="w-full px-3 py-2.5 bg-white rounded-xl border border-slate-200 focus:ring-1 focus:ring-slate-900 outline-none">
                          {availableCostCenters.length > 0 ? availableCostCenters.map(cc => (
                              <option key={cc.code} value={cc.code}>{cc.code} - {cc.name}</option>
                          )) : <option>No Cost Centers Found</option>}
                      </select>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <CreditCard size={20} /> {t('form.label.estCost')}
                    </h3>
                  </div>
                  <div className="relative">
                     <span className="absolute left-4 top-3.5 text-slate-500 font-bold">฿</span>
                     <input type="number" name="estimatedCost" value={estimatedCost} onChange={e => setEstimatedCost(Number(e.target.value))} className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none text-2xl font-bold text-slate-900" placeholder="0.00"/>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border transition-all ${policyFeedback?.compliant ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                        {policyFeedback ? (
                            <div>
                                <div className="flex items-center gap-2 font-bold mb-1">
                                    {policyFeedback.compliant ? <Check className="text-green-600" size={18}/> : <AlertCircle className="text-orange-600" size={18}/>}
                                    <span className={policyFeedback.compliant ? "text-green-700" : "text-orange-700"}>
                                        {policyFeedback.compliant ? t('form.policy.compliant') : t('form.policy.warning')}
                                    </span>
                                </div>
                                <p className="text-sm opacity-80 mb-2">{policyFeedback.message}</p>
                                <div className="flex flex-wrap gap-2">
                                    {policyFeedback.flags.map(flag => (
                                        <span key={flag} className="px-2 py-0.5 bg-white/50 rounded text-xs border border-black/5">{flag}</span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-400 text-sm flex items-center gap-2"><Info size={16}/> Review details to check policy</div>
                        )}
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 font-bold text-slate-800 mb-3">
                            <GitMerge size={18} className="text-blue-600"/> {t('form.approvalWorkflow')}
                        </div>
                        <div className="flex items-center text-xs">
                             {approvalFlow.map((step, idx) => (
                                 <React.Fragment key={idx}>
                                     <div className="flex flex-col items-center gap-1">
                                         <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                             {idx + 1}
                                         </div>
                                         <span className="font-semibold text-center leading-tight max-w-[60px]">{step}</span>
                                     </div>
                                     {idx < approvalFlow.length - 1 && (
                                         <div className="h-0.5 flex-1 bg-slate-200 mx-1 mb-4"></div>
                                     )}
                                 </React.Fragment>
                             ))}
                        </div>
                    </div>
                </div>
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center rounded-b-3xl">
            <button type="button" onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} disabled={currentStep === 0} className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`}>{t('form.back')}</button>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg">{t('form.next')} <ChevronRight size={18} /></button>
            ) : (
              <button type="submit" onClick={handleSubmit} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-green-200">{isEditMode ? t('form.update') : t('form.submit')} <Check size={18} /></button>
            )}
        </div>

      </div>
      <style>{`
        .label-sm { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; }
        .input-field { width: 100%; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; font-size: 0.875rem; outline: none; }
        .input-field:focus { border-color: #0f172a; ring: 1px solid #0f172a; }
        .service-btn { padding: 0.5rem 1rem; border-radius: 9999px; border-width: 1px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: all; }
      `}</style>
    </div>
  );
};
