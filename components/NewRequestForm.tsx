
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, User, Users, Briefcase, MapPin, 
  CalendarDays, CreditCard, Sparkles, Check, AlertCircle, 
  ChevronRight, Loader2, Building, Plus, Trash2, Info,
  Calculator, GitMerge, Languages, Clock, Moon, Bus, Train, Car, Luggage, UserCheck, Utensils, Shield, Eye, X
} from 'lucide-react';
import { TravelRequest, RequestFor, TravelType, TravelPolicy, TravelerDetails } from '../types';
import { generateJustification } from '../services/geminiService';
import { validatePolicy, calculateMileageReimbursement, getDailyPerDiem, getHotelLimit, getApprovalFlow } from '../services/policyRules';
import { storageService } from '../services/storage';
import { SearchableSelect } from './ui/SearchableSelect';
import { ServiceIcon } from './common/ServiceIcon'; // Shared Component
import { formatCurrency, formatDate } from '../utils/formatters'; // Shared Function
import { useTravelRequestForm } from '../hooks/useTravelRequestForm';
import { useTranslation } from '../services/translations';
import { useAiTranslation } from '../hooks/useAiTranslation';

interface NewRequestFormProps {
  initialData?: Partial<TravelRequest> | null;
  onCancel: () => void;
  onSubmit: (request: TravelRequest) => void;
}

const STEPS = ['form.step.travelers', 'form.step.trip', 'form.step.services', 'form.step.review'];

const ASIA_COUNTRIES = ["Thailand", "Japan", "South Korea", "China", "Hong Kong", "Taiwan", "Vietnam", "Singapore", "Malaysia", "Laos", "Cambodia", "Myanmar", "Philippines", "Indonesia", "India"];
const THAI_CITIES = ["Bangkok", "Chiang Mai", "Phuket", "Khon Kaen", "Pattaya", "Hat Yai", "Udon Thani", "Ubon Ratchathani"];

const INSURANCE_PLANS = [
    { id: 'HIPHOP', name: 'Hip Hop (Basic)', zone: 'ALL' },
    { id: 'BOOGIE', name: 'Boogie (Standard)', zone: 'ALL' },
    { id: 'SAMBA', name: 'Samba (Gold)', zone: 'ALL' },
    { id: 'TANGO', name: 'Tango (Platinum)', zone: 'WORLDWIDE_ONLY' },
];

export const NewRequestForm: React.FC<NewRequestFormProps> = ({ initialData, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const { translate, isLoading: isTranslating } = useAiTranslation();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [policyFeedback, setPolicyFeedback] = useState<{ compliant: boolean; message: string, flags: string[] } | null>(null);
  const [approvalFlow, setApprovalFlow] = useState<string[]>([]);
  const [currentPolicy, setCurrentPolicy] = useState<TravelPolicy | undefined>(undefined);
  const [isCoverageModalOpen, setIsCoverageModalOpen] = useState(false);

  // Dynamic Data State
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [availableCostCenters, setAvailableCostCenters] = useState<any[]>([]);
  
  // Options for Selects
  const [employeeOptions, setEmployeeOptions] = useState<{value: string, label: string, subLabel: string}[]>([]);
  const [empIdOptions, setEmpIdOptions] = useState<{value: string, label: string, subLabel: string}[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{value: string, label: string}[]>([]);
  
  // Static Reference Data State
  const [refData, setRefData] = useState<{ airports: any[], cities: string[], airlines: string[] }>({
      airports: [], cities: [], airlines: []
  });

  // Use Custom Hook for Logic
  const {
      requestFor, setRequestFor,
      travelType, setTravelType,
      travelers, addTraveler, updateTraveler, removeTraveler, selectEmployeeTraveler,
      trip, setTrip, handleTripChange,
      services, setServices, addService, removeService, updateService,
      estimatedCost, setEstimatedCost,
      calculateDays, buildRequestObject
  } = useTravelRequestForm(initialData);

  const isEditMode = !!(initialData && initialData.id);

  // Load Master Data (Projects, Employees, Policies, Static Refs)
  useEffect(() => {
    const loadMasterData = async () => {
        const [projs, ccs, pols, emps, airports, cities, airlines] = await Promise.all([
            storageService.getProjects(),
            storageService.getCostCenters(),
            storageService.getPolicies(),
            storageService.getEmployees(),
            storageService.getAirports(),
            storageService.getCities(),
            storageService.getAirlines()
        ]);
        
        setAvailableProjects(projs);
        setAvailableCostCenters(ccs);
        setCurrentPolicy(pols);
        setRefData({ airports, cities, airlines });
        
        // Transform Employees for Select (Name Search)
        setEmployeeOptions(emps.map(e => ({
            value: e.id,
            label: e.name,
            subLabel: `${e.department || 'General'} • ${e.email}`
        })));

        // Transform Employees for Select (ID Search)
        setEmpIdOptions(emps.map(e => ({
            value: e.id,
            label: e.id,
            subLabel: `${e.name} • ${e.department}`
        })));

        // Extract Unique Departments from Cost Centers & Employees
        const deptSet = new Set<string>();
        ccs.forEach(c => deptSet.add(c.department));
        emps.forEach(e => { if(e.department) deptSet.add(e.department); });
        
        setDepartmentOptions(Array.from(deptSet).map(d => ({ value: d, label: d })));
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

  // Helper to calculate nights between dates
  const calculateNights = (inDate: string, outDate: string) => {
      if (!inDate || !outDate) return 0;
      const start = new Date(inDate);
      const end = new Date(outDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays > 0 ? diffDays : 0;
  };

  // Helper: Smart Plan Selection
  const getRecommendedPlan = (dest: string) => {
      if (!dest) return 'BOOGIE';
      const isAsia = ASIA_COUNTRIES.some(c => dest.toLowerCase().includes(c.toLowerCase()));
      // Default to Boogie (Standard) for both, but could differentiate if needed
      return 'BOOGIE';
  };

  const getAvailablePlans = (dest: string) => {
      const isAsia = ASIA_COUNTRIES.some(c => dest.toLowerCase().includes(c.toLowerCase()));
      return INSURANCE_PLANS.filter(p => isAsia ? p.zone === 'ALL' : true);
  };

  // Real-time Policy & DOA Check using Rule Engine
  useEffect(() => {
      const runValidation = () => {
          // Guard: If no travelers yet (loading), skip validation to avoid undefined errors
          if (!travelers || travelers.length === 0 || !travelers[0]) {
              setApprovalFlow([]);
              setPolicyFeedback(null);
              return;
          }

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
          // Safe access to per diem amount
          const perDiemInfo = getDailyPerDiem(mainTraveler, travelType, trip.destination);
          const perDiem = perDiemInfo ? perDiemInfo.amount : 0;
          
          const maxBudget = (hotelLimit + (travelType === 'INTERNATIONAL' ? perDiem * 34 : perDiem)) * days * travelers.length + 20000; 
          
          if (estimatedCost > maxBudget && estimatedCost > 0) {
              allFlags.push(`Total cost exceeds typical allowances (Max approx ${formatCurrency(maxBudget)}).`);
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


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Determine ID: If edit, use existing. If new, generate next sequential ID.
    let requestId = initialData?.id;
    if (!requestId) {
        requestId = await storageService.generateNextRequestId();
    }
    
    const request = buildRequestObject(requestId, initialData?.status, policyFeedback?.flags);
    onSubmit(request);
    setIsSubmitting(false);
  };

  // --- LOCATION FILTERING LOGIC ---
  const filteredLocationOptions = useMemo(() => {
      const isDomestic = travelType === TravelType.DOMESTIC;
      
      const allAirports = refData.airports.map(a => ({ 
          value: a.code, 
          label: `${a.code} - ${a.name}`, 
          subLabel: a.city,
          isThai: a.country === 'Thailand' || THAI_CITIES.includes(a.city)
      }));
      
      const allCities = refData.cities.map(c => ({ 
          value: c, 
          label: c,
          isThai: THAI_CITIES.includes(c)
      }));

      // Helper to generate options based on scope
      const getOptions = (scope: 'DOMESTIC' | 'INTERNATIONAL' | 'ALL') => {
          const airportOpts = allAirports.filter(a => {
              if (scope === 'DOMESTIC') return a.isThai;
              if (scope === 'INTERNATIONAL') return !a.isThai;
              return true;
          });
          const cityOpts = allCities.filter(c => {
              if (scope === 'DOMESTIC') return c.isThai;
              if (scope === 'INTERNATIONAL') return !c.isThai;
              return true;
          });
          return [...airportOpts, ...cityOpts];
      };

      return {
          origin: getOptions(isDomestic ? 'DOMESTIC' : 'ALL'), // Intl trip can start from domestic
          destination: getOptions(isDomestic ? 'DOMESTIC' : 'INTERNATIONAL'),
          domesticOnly: getOptions('DOMESTIC'),
          intlOnly: getOptions('INTERNATIONAL')
      };
  }, [refData, travelType]);

  // Options Handlers
  const projectOptions = availableProjects.map(p => ({ value: p.code, label: p.code, subLabel: p.name }));
  const airlineOptions = refData.airlines.map(a => ({ value: a, label: a }));

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
                        {/* ... Traveler Fields (Same as before) ... */}
                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                                {traveler.type === 'Employee' ? t('form.label.dept') : t('form.label.company')}
                             </label>
                             {traveler.type === 'Employee' ? (
                                 <SearchableSelect 
                                    options={departmentOptions}
                                    value={traveler.department || ''}
                                    onChange={(val) => updateTraveler(idx, 'department', val)}
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
                                <SearchableSelect 
                                    options={empIdOptions}
                                    value={traveler.id.startsWith('NEW') || traveler.id.startsWith('AI-PAX') || traveler.id.startsWith('IMP') ? '' : traveler.id}
                                    onChange={(val) => selectEmployeeTraveler(idx, val)} // Auto-fills other fields
                                    placeholder="Select ID..."
                                />
                            </div>
                        )}

                        <div className={`sm:col-span-2 ${traveler.type === 'Employee' ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('form.label.fullName')}</label>
                            {traveler.type === 'Employee' ? (
                                <SearchableSelect 
                                    options={employeeOptions}
                                    value={traveler.id.startsWith('NEW') || traveler.id.startsWith('AI-PAX') || traveler.id.startsWith('IMP') ? '' : traveler.id} // Binds to ID but shows Name via Options
                                    onChange={(val) => selectEmployeeTraveler(idx, val)}
                                    placeholder="Search Name..."
                                />
                            ) : (
                                <input 
                                    type="text" 
                                    value={traveler.name}
                                    onChange={(e) => updateTraveler(idx, 'name', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                                    placeholder={t('form.label.fullName')}
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200 border-dashed">
                         {travelType === TravelType.INTERNATIONAL && (
                             <>
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
                             </>
                         )}
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">National ID / เลขบัตร ปชช.</label>
                            <input 
                                type="text" value={traveler.nationalId || ''}
                                onChange={(e) => updateTraveler(idx, 'nationalId', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                placeholder="1-xxxx-xxxxx-xx-x"
                            />
                         </div>
                         <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Home Address / ที่อยู่</label>
                            <input 
                                type="text" value={traveler.address || ''}
                                onChange={(e) => updateTraveler(idx, 'address', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                                placeholder="Current address for insurance"
                            />
                         </div>
                      </div>
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
                        options={filteredLocationOptions.origin}
                        value={trip.origin}
                        onChange={(val) => setTrip(prev => ({...prev, origin: val}))}
                        placeholder="Select Origin..."
                        icon={MapPin}
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t('form.label.dest')}</label>
                    <SearchableSelect 
                        options={filteredLocationOptions.destination}
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

              {/* Billable To (New Field) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Budget Reclaim / Bill To Agency</label>
                  <input 
                      type="text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Client Company A (Optional)"
                      value={trip.billableTo || ''}
                      onChange={(e) => handleTripChange('billableTo', e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty if charging to internal Cost Center only.</p>
              </div>

              {/* Purpose & Justification */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 relative overflow-hidden">
                  {/* Removed absolute background Wand2 icon */}

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
                   <button onClick={() => addService('FLIGHT')} className="service-btn bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"><ServiceIcon type="FLIGHT" size={16}/> Flight</button>
                   <button onClick={() => addService('HOTEL')} className="service-btn bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"><ServiceIcon type="HOTEL" size={16}/> Hotel</button>
                   
                   {/* Combined Ground Transport Visual Group */}
                   <div className="flex bg-slate-100 rounded-full p-1 gap-1">
                       <button onClick={() => addService('CAR')} className="service-btn-sm bg-green-50 text-green-700 border-green-200 hover:bg-green-100"><Car size={14}/> Car</button>
                       <button onClick={() => addService('TRAIN')} className="service-btn-sm bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300"><Train size={14}/> Train</button>
                       <button onClick={() => addService('BUS')} className="service-btn-sm bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300"><Bus size={14}/> Bus</button>
                   </div>

                   <button 
                        onClick={() => {
                            const id = `SVC-${Date.now()}`;
                            const newSvc: any = { 
                                id, type: 'INSURANCE', 
                                assignedTravelerIds: [],
                                plan: getRecommendedPlan(trip.destination) // Smart Default
                            };
                            setServices(prev => [...prev, newSvc]);
                        }} 
                        className="service-btn bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                   >
                       <ServiceIcon type="INSURANCE" size={16}/> Insurance
                   </button>
                   <button onClick={() => addService('EVENT')} className="service-btn bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"><ServiceIcon type="EVENT" size={16}/> Event Pass</button>
                </div>

                <div className="space-y-6">
                   {services.map((svc) => (
                      <div key={svc.id} className="border border-slate-200 rounded-xl shadow-sm animate-fade-in group bg-white">
                         <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center rounded-t-xl">
                             <div className="flex items-center gap-2 font-bold text-slate-700">
                                <div className={`p-1.5 rounded-lg ${svc.type === 'FLIGHT' ? 'bg-blue-100 text-blue-600' : svc.type === 'HOTEL' ? 'bg-orange-100 text-orange-600' : svc.type === 'INSURANCE' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                    <ServiceIcon type={svc.type} size={18}/>
                                </div>
                                <span>{svc.type} Request</span>
                             </div>
                             <button onClick={() => removeService(svc.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                         </div>

                         <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                             {/* --- TRAVELER ASSIGNMENT --- */}
                             <div className="md:col-span-2 bg-slate-100 p-2 rounded-lg flex items-center gap-3">
                                 <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                     <UserCheck size={14}/> Assign to:
                                 </div>
                                 <div className="flex flex-wrap gap-2">
                                     <label className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border cursor-pointer hover:border-blue-400">
                                         <input 
                                             type="checkbox" 
                                             checked={!svc.assignedTravelerIds || svc.assignedTravelerIds.length === 0}
                                             onChange={(e) => updateService(svc.id, 'assignedTravelerIds', e.target.checked ? [] : travelers.map(t => t.id))}
                                         />
                                         <span className="text-xs font-bold">Everyone</span>
                                     </label>
                                     {travelers.map(t => (
                                         <label key={t.id} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border cursor-pointer hover:border-blue-400">
                                             <input 
                                                 type="checkbox" 
                                                 checked={svc.assignedTravelerIds?.includes(t.id) || (!svc.assignedTravelerIds || svc.assignedTravelerIds.length === 0)}
                                                 onChange={(e) => {
                                                     const current = svc.assignedTravelerIds || [];
                                                     let next = [];
                                                     if (e.target.checked) {
                                                         const base = (current.length === 0) ? travelers.map(tr => tr.id) : current;
                                                         if (!base.includes(t.id)) next = [...base, t.id]; else next = base;
                                                     } else {
                                                         const base = (current.length === 0) ? travelers.map(tr => tr.id) : current;
                                                         next = base.filter(id => id !== t.id);
                                                     }
                                                     // If next includes all, make it empty again for cleanliness
                                                     if (next.length === travelers.length) next = [];
                                                     updateService(svc.id, 'assignedTravelerIds', next);
                                                 }}
                                             />
                                             <span className="text-xs text-slate-700">{t.name.split(' ')[0]}</span>
                                         </label>
                                     ))}
                                 </div>
                             </div>

                             {/* --- SERVICE SPECIFIC FIELDS --- */}

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
                                      <SearchableSelect options={filteredLocationOptions.origin} value={(svc as any).from} onChange={(v) => updateService(svc.id, 'from', v)} placeholder="Origin Airport" />
                                  </div>
                                  <div>
                                      <label className="label-sm">To</label>
                                      <SearchableSelect options={filteredLocationOptions.destination} value={(svc as any).to} onChange={(v) => updateService(svc.id, 'to', v)} placeholder="Dest Airport" />
                                  </div>
                                  
                                  {/* Departure Section */}
                                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <div className="col-span-2 text-[10px] font-bold text-blue-600 uppercase mb-1">Departure Flight</div>
                                      <div>
                                          <label className="label-sm">Date</label>
                                          <input type="date" value={(svc as any).departureDate} onChange={e => updateService(svc.id, 'departureDate', e.target.value)} className="input-field"/>
                                      </div>
                                      <div>
                                          <label className="label-sm">Preferred Time</label>
                                          <div className="relative">
                                              <Clock size={14} className="absolute left-3 top-3 text-slate-400"/>
                                              <input type="time" value={(svc as any).preferredDepartureTime || ''} onChange={e => updateService(svc.id, 'preferredDepartureTime', e.target.value)} className="input-field !pl-10"/>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Return Section (Conditional) */}
                                  {(svc as any).tripType === 'ROUND_TRIP' && (
                                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                          <div className="col-span-2 text-[10px] font-bold text-blue-600 uppercase mb-1">Return Flight</div>
                                          <div>
                                              <label className="label-sm">Date</label>
                                              <input type="date" value={(svc as any).returnDate} onChange={e => updateService(svc.id, 'returnDate', e.target.value)} className="input-field"/>
                                          </div>
                                          <div>
                                              <label className="label-sm">Preferred Time</label>
                                              <div className="relative">
                                                  <Clock size={14} className="absolute left-3 top-3 text-slate-400"/>
                                                  <input type="time" value={(svc as any).preferredReturnTime || ''} onChange={e => updateService(svc.id, 'preferredReturnTime', e.target.value)} className="input-field !pl-10"/>
                                              </div>
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

                                  {/* NEW: Baggage & Meal (Low Cost Extras) */}
                                  <div className="md:col-span-2 border-t border-slate-100 pt-3 mt-1 space-y-3">
                                      <div className="flex items-center gap-4">
                                          <label className="flex items-center gap-2 cursor-pointer bg-yellow-50 p-2 rounded-lg border border-yellow-200 flex-1">
                                              <input 
                                                  type="checkbox" 
                                                  checked={(svc as any).needExtraBaggage || false}
                                                  onChange={e => updateService(svc.id, 'needExtraBaggage', e.target.checked)}
                                              />
                                              <div>
                                                  <span className="text-sm font-bold text-yellow-800 flex items-center gap-1">
                                                      <Luggage size={14}/> Purchase Extra Baggage?
                                                  </span>
                                                  <span className="text-[10px] text-yellow-700">ซื้อน้ำหนักเพิ่ม</span>
                                              </div>
                                          </label>

                                          <label className="flex items-center gap-2 cursor-pointer bg-green-50 p-2 rounded-lg border border-green-200 flex-1">
                                              <input 
                                                  type="checkbox" 
                                                  checked={(svc as any).mealIncluded || false}
                                                  onChange={e => updateService(svc.id, 'mealIncluded', e.target.checked)}
                                              />
                                              <div>
                                                  <span className="text-sm font-bold text-green-800 flex items-center gap-1">
                                                      <Utensils size={14}/> Add In-flight Meal?
                                                  </span>
                                                  <span className="text-[10px] text-green-700">รับอาหารบนเครื่อง</span>
                                              </div>
                                          </label>
                                      </div>
                                  </div>
                                  
                                  {(svc as any).needExtraBaggage && (
                                      <div className="md:col-span-2 animate-fade-in bg-slate-50 p-3 rounded-lg border border-slate-100">
                                          <label className="label-sm text-slate-700">Required Weight (kg) / น้ำหนักที่ต้องการ</label>
                                          <div className="relative">
                                              <Luggage size={16} className="absolute left-3 top-3 text-slate-400"/>
                                              <input 
                                                  type="number" 
                                                  className="input-field !pl-10" 
                                                  placeholder="e.g. 20"
                                                  value={(svc as any).baggageWeight || ''}
                                                  onChange={e => updateService(svc.id, 'baggageWeight', parseFloat(e.target.value))}
                                              />
                                          </div>
                                      </div>
                                  )}
                                </>
                             )}

                             {svc.type === 'HOTEL' && (
                                <>
                                   <div className="md:col-span-2">
                                       <label className="label-sm">Area / City</label>
                                       <SearchableSelect options={filteredLocationOptions.destination} value={(svc as any).location} onChange={v => updateService(svc.id, 'location', v)} placeholder="Search Location..." />
                                   </div>
                                   <div className="md:col-span-2">
                                       <label className="label-sm">Preferred Hotel Name (Optional)</label>
                                       <input 
                                            type="text" 
                                            className="input-field" 
                                            placeholder="e.g. Hilton Sukhumvit"
                                            value={(svc as any).hotelName || ''}
                                            onChange={e => updateService(svc.id, 'hotelName', e.target.value)}
                                       />
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
                                   <div className="flex gap-2 items-center">
                                       <div className="w-1/3">
                                           <label className="label-sm">Rooms</label>
                                           <input 
                                                type="number" 
                                                min="1"
                                                className="input-field" 
                                                value={(svc as any).roomCount || 1} 
                                                onChange={e => updateService(svc.id, 'roomCount', parseInt(e.target.value))}
                                           />
                                       </div>
                                       <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center justify-center gap-2 mt-5">
                                            <Moon size={16} className="text-slate-400"/>
                                            <span className="text-sm font-bold text-slate-700">
                                                {calculateNights((svc as any).checkIn, (svc as any).checkOut)} Nights
                                            </span>
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
                                                  Reimbursement: {formatCurrency(calculateMileageReimbursement((svc as any).mileageDistance))}
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

                             {(svc.type === 'TRAIN' || svc.type === 'BUS') && (
                                <>
                                  <div className="md:col-span-2">
                                      <label className="label-sm">Route</label>
                                      <div className="flex gap-2">
                                         <input type="text" className="input-field" placeholder="From (e.g. Bangkok)" value={(svc as any).from} onChange={e => updateService(svc.id, 'from', e.target.value)}/>
                                         <input type="text" className="input-field" placeholder="To (e.g. Chiang Mai)" value={(svc as any).to} onChange={e => updateService(svc.id, 'to', e.target.value)}/>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="label-sm">Date</label>
                                      <input type="date" value={(svc as any).departureDate} onChange={e => updateService(svc.id, 'departureDate', e.target.value)} className="input-field"/>
                                  </div>
                                  <div>
                                      <label className="label-sm">Time Pref</label>
                                      <input type="time" value={(svc as any).departureTime} onChange={e => updateService(svc.id, 'departureTime', e.target.value)} className="input-field"/>
                                  </div>
                                </>
                             )}
                             
                             {svc.type === 'INSURANCE' && (
                                 <>
                                    <div className="md:col-span-2 bg-red-50 p-4 rounded-xl border border-red-100 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-white p-2 rounded-lg border border-red-100 text-red-600">
                                                <Shield size={24}/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="label-sm text-red-800">Coverage Plan</label>
                                                    <button onClick={() => setIsCoverageModalOpen(true)} className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                        <Eye size={12}/> View Conditions
                                                    </button>
                                                </div>
                                                <select 
                                                    className="w-full input-field font-bold text-slate-700" 
                                                    value={(svc as any).plan || getRecommendedPlan(trip.destination)}
                                                    onChange={e => updateService(svc.id, 'plan', e.target.value)}
                                                >
                                                    {getAvailablePlans(trip.destination).map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <p className="text-[10px] text-red-600 mt-1">
                                                    *Recommended based on destination: {getRecommendedPlan(trip.destination) === 'BOOGIE' ? 'Standard' : 'Asia'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Auto-filled Info Block */}
                                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Insured Persons (Auto-filled from Profile)</div>
                                            <div className="space-y-2">
                                                {/* Filter travelers assigned to this service (or all if none selected) */}
                                                {(svc.assignedTravelerIds && svc.assignedTravelerIds.length > 0 
                                                    ? travelers.filter(t => svc.assignedTravelerIds?.includes(t.id)) 
                                                    : travelers
                                                ).map((t, idx) => (
                                                    <div key={idx} className="text-xs border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                                        <div className="font-bold text-slate-800">{t.title} {t.name}</div>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-slate-500">
                                                            <div>Route: <span className="text-slate-800">{trip.origin} - {trip.destination}</span></div>
                                                            <div>Period: <span className="text-slate-800">{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span></div>
                                                            <div>ID Card: <span className="text-slate-800">{t.nationalId || '-'}</span></div>
                                                            <div>DOB: <span className="text-slate-800">{t.dateOfBirth || '-'}</span></div>
                                                            <div className="col-span-2">Address: <span className="text-slate-800">{t.address || t.department + ' (Company Address)'}</span></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Beneficiary */}
                                        <div>
                                            <label className="label-sm">Beneficiary with Relationship</label>
                                            <input 
                                                type="text" 
                                                className="input-field" 
                                                placeholder="e.g. Jane Doe (Mother)"
                                                value={(svc as any).beneficiary || ''}
                                                onChange={e => updateService(svc.id, 'beneficiary', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                 </>
                             )}

                             {svc.type === 'EVENT' && (
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
                {/* ... existing step 3 content ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('form.label.project')}</label>
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
            <button type="button" onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))} disabled={currentStep === 0 || isSubmitting} className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${currentStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'}`}>{t('form.back')}</button>
            {currentStep < STEPS.length - 1 ? (
              <button type="button" onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg">{t('form.next')} <ChevronRight size={18} /></button>
            ) : (
              <button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-green-200 disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : (isEditMode ? t('form.update') : t('form.submit'))} 
                  {!isSubmitting && <Check size={18} />}
              </button>
            )}
        </div>

      </div>

      {/* COVERAGE MODAL */}
      {isCoverageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                      <h3 className="font-bold text-lg">Insurance Coverage Plans</h3>
                      <button onClick={() => setIsCoverageModalOpen(false)}><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                      <table className="w-full text-xs md:text-sm border-collapse">
                          <thead className="bg-blue-50 text-blue-900 sticky top-0">
                              <tr>
                                  <th className="p-2 border text-left">Coverage Item</th>
                                  <th className="p-2 border text-center bg-blue-100">Hip Hop</th>
                                  <th className="p-2 border text-center bg-green-100">Boogie (Std)</th>
                                  <th className="p-2 border text-center bg-red-100">Samba</th>
                                  <th className="p-2 border text-center bg-orange-100">Tango</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr><td className="p-2 border font-bold">1. Loss of Life / Accident</td><td className="p-2 border text-center">1,500,000</td><td className="p-2 border text-center">2,000,000</td><td className="p-2 border text-center">5,000,000</td><td className="p-2 border text-center">6,000,000</td></tr>
                              <tr><td className="p-2 border font-bold">2. Medical Expense</td><td className="p-2 border text-center">2,000,000</td><td className="p-2 border text-center">2,000,000</td><td className="p-2 border text-center">3,000,000</td><td className="p-2 border text-center">4,000,000</td></tr>
                              <tr><td className="p-2 border font-bold">3. Emergency Evacuation</td><td className="p-2 border text-center">4,000,000</td><td className="p-2 border text-center">4,000,000</td><td className="p-2 border text-center">5,000,000</td><td className="p-2 border text-center">5,000,000</td></tr>
                              <tr><td className="p-2 border font-bold">6. Trip Cancellation</td><td className="p-2 border text-center">50,000</td><td className="p-2 border text-center">100,000</td><td className="p-2 border text-center">100,000</td><td className="p-2 border text-center">500,000</td></tr>
                              <tr><td className="p-2 border font-bold">8. Travel Delay</td><td className="p-2 border text-center">-</td><td className="p-2 border text-center">10,000</td><td className="p-2 border text-center">40,000</td><td className="p-2 border text-center">50,000</td></tr>
                              <tr><td className="p-2 border font-bold">10. Baggage Loss</td><td className="p-2 border text-center">-</td><td className="p-2 border text-center">15,000</td><td className="p-2 border text-center">50,000</td><td className="p-2 border text-center">50,000</td></tr>
                          </tbody>
                      </table>
                      <p className="mt-4 text-xs text-slate-500">* All values in THB. Refer to full policy document for details.</p>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        .label-sm { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; }
        .input-field { width: 100%; padding: 0.5rem 0.75rem; background-color: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; font-size: 0.875rem; outline: none; }
        .input-field:focus { border-color: #0f172a; ring: 1px solid #0f172a; }
        .service-btn { padding: 0.5rem 1rem; border-radius: 9999px; border-width: 1px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: all; }
        .service-btn-sm { padding: 0.5rem 0.75rem; border-radius: 9999px; border-width: 1px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: all; }
      `}</style>
    </div>
  );
};
