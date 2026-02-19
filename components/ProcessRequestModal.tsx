import React, { useState, useEffect } from 'react';
import { 
  X, Mail, CheckCircle, AlertTriangle, 
  Send, Loader2, ArrowRight, Eye, Plus, Trash2, Save, SendToBack, Shield,
  UserCheck, CalendarDays, FileText, Tag, Clock, Copy, Plane, Hotel, Car, Train, Bus
} from 'lucide-react';
import { TravelRequest, RequestStatus, Agency, QuotationOption, ServiceType, TravelServiceItem } from '../types';
import { checkPolicyCompliance, parseVendorQuote } from '../services/geminiService';
import { getSLAStatus } from '../services/slaService';
import { storageService } from '../services/storage';
import { formatCurrency } from '../utils/formatters'; // Shared
import { ServiceIcon } from './common/ServiceIcon'; // Shared

// --- SCOPE MAPPING ---
const AGENCY_SERVICE_SCOPE: Record<string, ServiceType[]> = {
    'Full Service': ['FLIGHT', 'HOTEL', 'CAR', 'INSURANCE', 'EVENT', 'TRAIN', 'BUS'],
    'Low Cost': ['FLIGHT'],
    'Hotel Specialist': ['HOTEL', 'EVENT', 'INSURANCE'],
    'Car Rental': ['CAR', 'BUS', 'TRAIN']
};

interface ProcessRequestModalProps {
  request: TravelRequest;
  onClose: () => void;
  onUpdate: (updatedRequest: TravelRequest, keepOpen?: boolean) => void;
}

// Compact Input Component for Cleaner Code
const CompactInput = ({ label, value, onChange, placeholder, type = "text", className = "" }: any) => (
    <div className={`flex flex-col ${className}`}>
        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</label>
        <input 
            type={type}
            value={value} 
            onChange={onChange} 
            placeholder={placeholder}
            className="w-full text-xs font-medium text-slate-700 bg-transparent border-b border-slate-200 py-1 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-slate-300"
        />
    </div>
);

const CostInput = ({ label, value, onChange, isTotal = false }: any) => (
    <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase ${isTotal ? 'text-green-600' : 'text-slate-400'}`}>{label}</span>
        <input 
            type="number" 
            className={`w-20 text-right text-xs bg-transparent border-b ${isTotal ? 'border-green-200 text-green-700 font-bold' : 'border-slate-200 text-slate-600'} focus:outline-none py-0.5`}
            value={value || 0}
            onChange={e => onChange(parseFloat(e.target.value))}
        />
    </div>
);

export const ProcessRequestModal: React.FC<ProcessRequestModalProps> = ({ request, onClose, onUpdate }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<string[]>([]);
  const [sentAgencyLog, setSentAgencyLog] = useState<string[]>(request.sentToAgencies || []);
  const [sendingStatus, setSendingStatus] = useState<string>('');

  const [quotations, setQuotations] = useState<QuotationOption[]>(request.quotations || []);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);

  const [policyCheck, setPolicyCheck] = useState<{ compliant: boolean; message: string; flags: string[] } | null>(null);
  const [exceptionReason, setExceptionReason] = useState(request.policyExceptionReason || '');
  
  const sla = getSLAStatus(request.slaDeadline, request.status);

  // Sync state
  useEffect(() => {
    setSentAgencyLog(request.sentToAgencies || []);
    if (request.quotations) setQuotations(request.quotations);
  }, [request.sentToAgencies, request.quotations]);

  useEffect(() => {
      const loadAgencies = async () => {
        const loaded = await storageService.getAgencies();
        setAgencies(loaded);
        if (selectedAgencyIds.length === 0 && !request.vendorQuotationSentAt) {
            const requiredServices = new Set(request.services.map(s => s.type));
            const relevant = loaded.filter(a => 
                a.isPreferred && 
                AGENCY_SERVICE_SCOPE[a.type]?.some(scope => requiredServices.has(scope))
            );
            setSelectedAgencyIds(relevant.map(a => a.id));
        }
      };
      loadAgencies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize a default quote if none exist
  useEffect(() => {
      if (step === 2 && quotations.length === 0) {
          const defaultQuote: QuotationOption = {
              id: `Q-${Date.now()}`,
              name: 'Option 1: Primary',
              totalAmount: 0,
              services: request.services.map(s => ({ ...s, actualCost: 0, costExclVat: 0, vatAmount: 0 })),
              isSelected: true
          };
          setQuotations([defaultQuote]);
          setActiveQuoteId(defaultQuote.id);
      } else if (step === 2 && quotations.length > 0 && !activeQuoteId) {
          setActiveQuoteId(quotations[0].id);
      }
  }, [step]);

  const handleToggleAgency = (id: string) => {
    setSelectedAgencyIds(prev => 
      prev.includes(id) 
        ? prev.filter(aid => aid !== id) 
        : [...prev, id]
    );
  };

  const generateEmailBody = (agency: Agency) => {
      const allowedServices = AGENCY_SERVICE_SCOPE[agency.type] || [];
      const relevantServices = request.services.filter(s => allowedServices.includes(s.type));

      let body = `Dear ${agency.name} Team,\n\nPlease provide a quotation for the following request:\n\n`;
      body += `Request ID: ${request.id}\n`;
      body += `Destination: ${request.trip.destination}\n`;
      body += `Dates: ${request.trip.startDate} to ${request.trip.endDate}\n\n`;
      
      if (relevantServices.length > 0) {
          body += `Services Required (${agency.type}):\n`;
          relevantServices.forEach(s => {
              body += `- ${s.type}: ${s.type === 'FLIGHT' ? (s as any).from + ' to ' + (s as any).to : (s as any).location || 'Details'} \n`;
              // Add traveler info if split
              const assignedIds = s.assignedTravelerIds || [];
              if (assignedIds.length > 0) {
                  const assignedNames = request.travelers.filter(t => assignedIds.includes(t.id)).map(t => t.name).join(', ');
                  body += `  For: ${assignedNames}\n`;
              }
              if (s.type === 'HOTEL' && (s as any).hotelName) body += `  Preferred Hotel: ${(s as any).hotelName}\n`;
              if (s.type === 'FLIGHT' && (s as any).preferredDepartureTime) body += `  Time: ${(s as any).preferredDepartureTime}\n`;
          });
      } else {
          body += `(No services in this request match your agency type: ${agency.type})\n`;
      }

      body += `\nThank you,\nCDG Travel Team`;
      return body;
  };

  const handleSendEmails = async () => {
      if (selectedAgencyIds.length === 0) return;
      setIsLoading(true);
      
      const targets = agencies.filter(a => selectedAgencyIds.includes(a.id));
      const primaryAgency = targets[0];
      
      if (primaryAgency) {
          setSendingStatus(`Preparing email for ${primaryAgency.name}...`);
          const subject = `RFQ: Travel Request ${request.id} - ${request.trip.destination}`;
          const body = generateEmailBody(primaryAgency);
          window.location.href = `mailto:${primaryAgency.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newSentLog = [...sentAgencyLog, ...selectedAgencyIds.filter(id => !sentAgencyLog.includes(id))];
      setSentAgencyLog(newSentLog); 
      
      const updatedReq = {
          ...request,
          status: RequestStatus.QUOTATION_PENDING,
          sentToAgencies: newSentLog,
          vendorQuotationSentAt: new Date().toISOString()
      };
      
      onUpdate(updatedReq, true); 
      
      setSendingStatus('');
      setIsLoading(false);
      setStep(2); 
  };

  // --- Quote Management ---

  const addNewQuoteOption = () => {
      const newQuote: QuotationOption = {
          id: `Q-${Date.now()}`,
          name: `Option ${quotations.length + 1}`,
          totalAmount: 0,
          services: request.services.map(s => ({...s, actualCost: 0, costExclVat: 0, vatAmount: 0})),
          isSelected: false
      };
      setQuotations([...quotations, newQuote]);
      setActiveQuoteId(newQuote.id);
  };

  const removeQuoteOption = (id: string) => {
      const newQuotes = quotations.filter(q => q.id !== id);
      setQuotations(newQuotes);
      if (activeQuoteId === id) setActiveQuoteId(newQuotes[0]?.id || null);
  };

  // Helper for Cost Calculations
  const updateServiceCost = (serviceId: string, field: 'actualCost' | 'costExclVat' | 'vatAmount', value: number) => {
      if (!activeQuoteId) return;
      setQuotations(prev => prev.map(q => {
          if (q.id === activeQuoteId) {
              const updatedServices = q.services.map(s => {
                  if (s.id === serviceId) {
                      const updatedS = { ...s, [field]: value };
                      // Logic: 
                      // If Total changed -> Recalc Base & VAT (assuming 7%)
                      // If Base changed -> Recalc VAT & Total
                      if (field === 'actualCost') {
                          updatedS.costExclVat = Number((value / 1.07).toFixed(2));
                          updatedS.vatAmount = Number((value - (value / 1.07)).toFixed(2));
                      } else if (field === 'costExclVat') {
                          updatedS.vatAmount = Number((value * 0.07).toFixed(2));
                          updatedS.actualCost = Number((value + (value * 0.07)).toFixed(2));
                      } else if (field === 'vatAmount') {
                          // If VAT changed manually, just update Total
                          updatedS.actualCost = Number(((updatedS.costExclVat || 0) + value).toFixed(2));
                      }
                      return updatedS;
                  }
                  return s;
              });
              const total = updatedServices.reduce((sum, s) => sum + (s.actualCost || 0), 0);
              return { ...q, services: updatedServices, totalAmount: total };
          }
          return q;
      }));
  };

  const updateActiveQuoteService = (serviceId: string, field: string, value: any) => {
      if (!activeQuoteId) return;
      setQuotations(prev => prev.map(q => {
          if (q.id === activeQuoteId) {
              const updatedServices = q.services.map(s => s.id === serviceId ? { ...s, [field]: value } : s);
              return { ...q, services: updatedServices };
          }
          return q;
      }));
  };

  const updateActiveQuoteMeta = (field: string, value: any) => {
      if (!activeQuoteId) return;
      setQuotations(prev => prev.map(q => q.id === activeQuoteId ? { ...q, [field]: value } : q));
  };

  // --- Final Actions ---

  const runPolicyCheck = async () => {
     if (!activeQuoteId) return;
     const currentQuote = quotations.find(q => q.id === activeQuoteId);
     if (!currentQuote) return;

     setIsLoading(true);
     const check = await checkPolicyCompliance(
         request.trip.destination, 
         currentQuote.totalAmount, 
         3,
         request.travelType, 
         request.requestFor
     );
     setPolicyCheck(check);
     setIsLoading(false);
  };

  const handleSelectAndSubmit = () => {
      if (!activeQuoteId) return;
      const selectedQuote = quotations.find(q => q.id === activeQuoteId);
      if (!selectedQuote) return;

      const finalQuotes = quotations.map(q => ({...q, isSelected: q.id === activeQuoteId}));

      const updatedReq: TravelRequest = {
          ...request,
          quotations: finalQuotes,
          services: selectedQuote.services, 
          actualCost: selectedQuote.totalAmount,
          status: RequestStatus.PENDING_APPROVAL,
          policyExceptionReason: exceptionReason,
          policyFlags: policyCheck?.flags || []
      };
      
      onUpdate(updatedReq, false); 
      onClose();
  };

  const handleSendToEmployee = () => {
      const updatedReq: TravelRequest = {
          ...request,
          quotations: quotations,
          status: RequestStatus.WAITING_EMPLOYEE_SELECTION
      };
      onUpdate(updatedReq, false);
      onClose();
  };

  const groupedAgencies = agencies.reduce((acc, agency) => {
      if (!acc[agency.type]) acc[agency.type] = [];
      acc[agency.type].push(agency);
      return acc;
  }, {} as Record<string, Agency[]>);

  const activeQuote = quotations.find(q => q.id === activeQuoteId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden">
           {/* Header */}
           <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
               <div>
                   <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                       <span className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                           {step}
                       </span>
                       {step === 1 ? 'Vendor Quotation (RFQ)' : 'Process & Compare Quotes'}
                   </h2>
                   <p className="text-slate-500 text-xs mt-0.5 ml-8">Request #{request.id} • {request.trip.destination}</p>
               </div>
               <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 transition-colors">
                   <X size={20} />
               </button>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
               
               {/* STEP 1: SEND RFQ */}
               {step === 1 && (
                   <div className="space-y-6 max-w-4xl mx-auto">
                        <div className="flex items-start gap-4 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
                           <Mail className="shrink-0 mt-0.5" size={18}/>
                           <div>
                               <strong>SLA Status: </strong> 
                               <span className={sla?.urgent ? 'text-red-600 font-bold' : 'text-blue-600'}>
                                   {sla?.label || 'Calculating...'}
                               </span>
                               <p className="mt-1 opacity-80">Select vendors below to request quotes.</p>
                           </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {Object.entries(groupedAgencies).map(([type, group]) => (
                               <div key={type} className="space-y-2">
                                   <h3 className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2 border-b border-slate-200 pb-1 mb-2">
                                       {type} <span className="text-slate-400 font-normal ml-auto">({group.length})</span>
                                   </h3>
                                   {group.map(agency => (
                                       <div 
                                         key={agency.id} 
                                         onClick={() => handleToggleAgency(agency.id)}
                                         className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group
                                            ${selectedAgencyIds.includes(agency.id) ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                                       >
                                           <div>
                                               <div className="font-bold text-slate-900 text-sm">{agency.name}</div>
                                               <div className="text-xs text-slate-500">{agency.email}</div>
                                           </div>
                                           {selectedAgencyIds.includes(agency.id) && <CheckCircle className="text-blue-600" size={18}/>}
                                       </div>
                                   ))}
                               </div>
                           ))}
                       </div>

                       {selectedAgencyIds.length > 0 && (
                           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fade-in mt-4">
                               <div className="flex justify-between items-center mb-2">
                                   <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                       <Eye size={16}/> Preview for: 
                                       <span className="text-blue-600">{agencies.find(a => a.id === selectedAgencyIds[0])?.name || 'Selected Vendor'}</span>
                                   </div>
                               </div>
                               <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs font-mono text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                   {generateEmailBody(agencies.find(a => a.id === selectedAgencyIds[0]) || agencies[0])}
                               </div>
                           </div>
                       )}
                   </div>
               )}

               {/* STEP 2: INPUT COSTS & OPTIONS */}
               {step === 2 && (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                       
                       {/* LEFT: Options List */}
                       <div className="space-y-4">
                           <div className="flex justify-between items-center px-1">
                               <h3 className="font-bold text-slate-700 text-xs uppercase">Quotes Received</h3>
                               <button onClick={addNewQuoteOption} className="text-xs bg-slate-900 text-white hover:bg-slate-700 px-2 py-1 rounded font-bold flex items-center gap-1 shadow-sm"><Plus size={12}/> Add Option</button>
                           </div>

                           <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                               {quotations.map(quote => (
                                   <div 
                                       key={quote.id} 
                                       onClick={() => setActiveQuoteId(quote.id)}
                                       className={`p-3 rounded-lg border cursor-pointer transition-all relative group
                                           ${activeQuoteId === quote.id ? 'border-blue-600 bg-white shadow-md ring-1 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                                   >
                                       <div className="flex justify-between items-center mb-1">
                                           <span className={`font-bold text-sm ${activeQuoteId === quote.id ? 'text-blue-700' : 'text-slate-700'}`}>{quote.name}</span>
                                           <span className="font-mono text-sm font-bold text-green-600">{formatCurrency(quote.totalAmount)}</span>
                                       </div>
                                       <div className="text-xs text-slate-400 truncate flex items-center gap-2">
                                           <span>{quote.services.length} items</span>
                                           {quote.quoteRef && <span>• Ref: {quote.quoteRef}</span>}
                                       </div>
                                       
                                       {quotations.length > 1 && (
                                           <button 
                                             onClick={(e) => { e.stopPropagation(); removeQuoteOption(quote.id); }}
                                             className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-500 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                           >
                                               <X size={10}/>
                                           </button>
                                       )}
                                   </div>
                               ))}
                           </div>
                       </div>

                       {/* RIGHT: Active Option Details */}
                       <div className="lg:col-span-2 flex flex-col h-full">
                           {activeQuote ? (
                               <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                                   {/* Header Section */}
                                   <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                                       <div className="flex justify-between items-start gap-4 mb-3">
                                            <div className="flex-1">
                                                <input 
                                                    type="text" 
                                                    value={activeQuote.name} 
                                                    onChange={(e) => updateActiveQuoteMeta('name', e.target.value)}
                                                    className="bg-transparent font-bold text-lg text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full"
                                                    placeholder="Option Name"
                                                />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Estimate</div>
                                                <div className="text-xl font-bold text-slate-900 tracking-tight">{formatCurrency(activeQuote.totalAmount)}</div>
                                            </div>
                                       </div>
                                       <div className="flex gap-4">
                                            <div className="flex items-center gap-2 flex-1">
                                                <Tag size={14} className="text-slate-400"/>
                                                <input 
                                                    placeholder="Vendor Ref (e.g. QT-1234)"
                                                    value={activeQuote.quoteRef || ''} 
                                                    onChange={(e) => updateActiveQuoteMeta('quoteRef', e.target.value)}
                                                    className="bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-xs w-full py-1"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 flex-1">
                                                <CalendarDays size={14} className="text-slate-400"/>
                                                <input 
                                                    type="date"
                                                    value={activeQuote.validUntil || ''} 
                                                    onChange={(e) => updateActiveQuoteMeta('validUntil', e.target.value)}
                                                    className="bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-xs w-full py-1"
                                                />
                                            </div>
                                       </div>
                                   </div>

                                   {/* Services Editor */}
                                   <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-white">
                                       {activeQuote.services.map((svc: TravelServiceItem, idx: number) => {
                                           const assignedIds = svc.assignedTravelerIds || [];
                                           return (
                                           <div key={svc.id} className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition-colors group relative">
                                               {/* Duplicate Action */}
                                               <button 
                                                    title="Duplicate"
                                                    onClick={() => {
                                                        const newSvc = { ...svc, id: `SVC-${Date.now()}`, assignedTravelerIds: [] };
                                                        const newSvcs = [...activeQuote.services];
                                                        newSvcs.splice(idx + 1, 0, newSvc as any);
                                                        setQuotations(prev => prev.map(q => q.id === activeQuoteId ? { ...q, services: newSvcs } : q));
                                                    }}
                                                    className="absolute top-2 right-2 text-slate-300 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                               >
                                                   <Copy size={14}/>
                                               </button>

                                               {/* Header Row */}
                                               <div className="flex items-center gap-3 mb-3">
                                                   <div className={`p-1.5 rounded-md ${svc.type === 'FLIGHT' ? 'bg-blue-100 text-blue-600' : svc.type === 'HOTEL' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                                                        <ServiceIcon type={svc.type} size={16}/>
                                                   </div>
                                                   <div>
                                                       <div className="font-bold text-xs text-slate-700">{svc.type}</div>
                                                       <input 
                                                            className="text-[10px] text-slate-500 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none w-32"
                                                            value={svc.bookingReference || ''} 
                                                            onChange={e => updateActiveQuoteService(svc.id, 'bookingReference', e.target.value)} 
                                                            placeholder="Add Ref/PNR..." 
                                                       />
                                                   </div>
                                                   
                                                   {/* Compact Traveler Assignment */}
                                                   <div className="ml-auto flex items-center gap-1 bg-slate-50 rounded-full px-2 py-0.5 border border-slate-100">
                                                        <UserCheck size={12} className="text-slate-400"/>
                                                        {request.travelers.map(t => (
                                                            <button 
                                                                key={t.id} 
                                                                onClick={() => {
                                                                    let next: string[] = [];
                                                                    if (assignedIds.includes(t.id)) {
                                                                        next = assignedIds.filter((id: string) => id !== t.id);
                                                                    } else {
                                                                        next = [...assignedIds, t.id];
                                                                    }
                                                                    updateActiveQuoteService(svc.id, 'assignedTravelerIds', next);
                                                                }}
                                                                className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center transition-all ${
                                                                    (assignedIds.includes(t.id) || assignedIds.length === 0)
                                                                    ? 'bg-blue-600 text-white' 
                                                                    : 'bg-white text-slate-300 border border-slate-200'
                                                                }`}
                                                                title={t.name}
                                                            >
                                                                {t.name.charAt(0)}
                                                            </button>
                                                        ))}
                                                   </div>
                                               </div>

                                               {/* Fields Grid */}
                                               <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 mb-3">
                                                   {svc.type === 'FLIGHT' && (
                                                       <>
                                                           <CompactInput label="Airline" value={(svc as any).airlinePreference} onChange={(e: any) => updateActiveQuoteService(svc.id, 'airlinePreference', e.target.value)} />
                                                           <CompactInput label="Flight No" value={(svc as any).flightNumber} onChange={(e: any) => updateActiveQuoteService(svc.id, 'flightNumber', e.target.value)} />
                                                           <CompactInput label="Class" value={(svc as any).flightClass} onChange={(e: any) => updateActiveQuoteService(svc.id, 'flightClass', e.target.value)} />
                                                           <CompactInput label="Seat No" value={(svc as any).seatNumber} onChange={(e: any) => updateActiveQuoteService(svc.id, 'seatNumber', e.target.value)} />
                                                           <CompactInput label="Ticket No" value={(svc as any).ticketNumber} onChange={(e: any) => updateActiveQuoteService(svc.id, 'ticketNumber', e.target.value)} className="col-span-2" />
                                                           <CompactInput label="Fare Rules" value={(svc as any).fareRules} onChange={(e: any) => updateActiveQuoteService(svc.id, 'fareRules', e.target.value)} className="col-span-2" />
                                                       </>
                                                   )}
                                                   {svc.type === 'HOTEL' && (
                                                       <>
                                                           <CompactInput label="Hotel Name" value={(svc as any).hotelName} onChange={(e: any) => updateActiveQuoteService(svc.id, 'hotelName', e.target.value)} className="col-span-2"/>
                                                           <CompactInput label="Conf No" value={(svc as any).confirmationNumber} onChange={(e: any) => updateActiveQuoteService(svc.id, 'confirmationNumber', e.target.value)} />
                                                           <CompactInput label="Room Type" value={(svc as any).roomType} onChange={(e: any) => updateActiveQuoteService(svc.id, 'roomType', e.target.value)} />
                                                       </>
                                                   )}
                                                   {svc.type === 'CAR' && (
                                                       <>
                                                           <CompactInput label="Vendor" value={(svc as any).vendor} onChange={(e: any) => updateActiveQuoteService(svc.id, 'vendor', e.target.value)} />
                                                           <CompactInput label="Vehicle" value={(svc as any).vehicleDetails} onChange={(e: any) => updateActiveQuoteService(svc.id, 'vehicleDetails', e.target.value)} />
                                                           <CompactInput label="Driver" value={(svc as any).driverName} onChange={(e: any) => updateActiveQuoteService(svc.id, 'driverName', e.target.value)} />
                                                           <CompactInput label="Contact" value={(svc as any).driverContact} onChange={(e: any) => updateActiveQuoteService(svc.id, 'driverContact', e.target.value)} />
                                                       </>
                                                   )}
                                               </div>

                                               {/* Schedule Block */}
                                               <div className="bg-blue-50/50 border border-blue-100 rounded-md p-2 mb-2 grid grid-cols-2 gap-4">
                                                    {svc.type === 'FLIGHT' && (
                                                        <>
                                                            <CompactInput type="datetime-local" label="Depart Time" value={(svc as any).exactDepartureTime || ''} onChange={(e: any) => updateActiveQuoteService(svc.id, 'exactDepartureTime', e.target.value)} />
                                                            <CompactInput type="datetime-local" label="Arrive Time" value={(svc as any).exactArrivalTime || ''} onChange={(e: any) => updateActiveQuoteService(svc.id, 'exactArrivalTime', e.target.value)} />
                                                        </>
                                                    )}
                                                    {svc.type === 'HOTEL' && (
                                                        <>
                                                            <CompactInput type="date" label="Check-in" value={(svc as any).checkIn || ''} onChange={(e: any) => updateActiveQuoteService(svc.id, 'checkIn', e.target.value)} />
                                                            <CompactInput type="date" label="Check-out" value={(svc as any).checkOut || ''} onChange={(e: any) => updateActiveQuoteService(svc.id, 'checkOut', e.target.value)} />
                                                        </>
                                                    )}
                                                    {svc.type === 'CAR' && (
                                                        <>
                                                            <CompactInput type="datetime-local" label="Pickup" value={(svc as any).exactPickupTime || ''} onChange={(e: any) => updateActiveQuoteService(svc.id, 'exactPickupTime', e.target.value)} />
                                                            <CompactInput type="datetime-local" label="Dropoff" value={(svc as any).exactDropoffTime || ''} onChange={(e: any) => updateActiveQuoteService(svc.id, 'exactDropoffTime', e.target.value)} />
                                                        </>
                                                    )}
                                                    {/* Fallback for others */}
                                                    {!['FLIGHT','HOTEL','CAR'].includes(svc.type) && (
                                                        <div className="col-span-2 text-xs text-slate-400 italic">No specific schedule fields for this type.</div>
                                                    )}
                                               </div>

                                               {/* Cost Row */}
                                               <div className="flex justify-end items-center gap-4 pt-2 border-t border-dashed border-slate-200">
                                                   <CostInput label="Base (Ex. VAT)" value={svc.costExclVat} onChange={(v: number) => updateServiceCost(svc.id, 'costExclVat', v)} />
                                                   <CostInput label="VAT (7%)" value={svc.vatAmount} onChange={(v: number) => updateServiceCost(svc.id, 'vatAmount', v)} />
                                                   <CostInput label="Total" value={svc.actualCost} onChange={(v: number) => updateServiceCost(svc.id, 'actualCost', v)} isTotal />
                                               </div>
                                           </div>
                                       )})}
                                   </div>

                                   {/* Policy Footer */}
                                   <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                                       {policyCheck ? (
                                           <div className={`flex items-center gap-2 ${policyCheck.compliant ? 'text-green-600' : 'text-red-600'}`}>
                                               {policyCheck.compliant ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                                               <span className="font-bold">{policyCheck.compliant ? 'Policy Compliant' : 'Violates Policy'}</span>
                                               {!policyCheck.compliant && <span className="text-red-400">({policyCheck.message})</span>}
                                           </div>
                                       ) : (
                                           <button onClick={runPolicyCheck} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 font-bold">
                                               <Shield size={14}/> Check Policy
                                           </button>
                                       )}
                                       
                                       {!policyCheck?.compliant && policyCheck && (
                                            <input 
                                                className="border rounded px-2 py-1 w-64 focus:outline-none focus:border-blue-500" 
                                                placeholder="Enter Exception Reason..."
                                                value={exceptionReason}
                                                onChange={e => setExceptionReason(e.target.value)}
                                            />
                                       )}
                                   </div>
                               </div>
                           ) : (
                               <div className="flex flex-col items-center justify-center h-full text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                                   <FileText size={48} className="mb-4 opacity-50"/>
                                   <p>Select a quote option to edit details</p>
                               </div>
                           )}
                       </div>
                   </div>
               )}

           </div>

           {/* Footer Actions */}
           <div className="p-5 border-t border-slate-100 bg-white flex justify-between items-center">
               {step === 1 ? (
                   <>
                     <button onClick={onClose} className="px-6 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors">Cancel</button>
                     
                     {request.status === RequestStatus.QUOTATION_PENDING ? (
                        <button 
                            onClick={() => setStep(2)} 
                            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 flex items-center gap-2 text-sm shadow-lg shadow-slate-200"
                        >
                            Skip to Quotation <ArrowRight size={16}/>
                        </button>
                     ) : (
                        <button 
                            onClick={handleSendEmails} 
                            disabled={selectedAgencyIds.length === 0 || isLoading}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-lg shadow-blue-200"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
                            {isLoading ? sendingStatus : 'Request Quotes'}
                        </button>
                     )}
                   </>
               ) : (
                   <>
                     <button onClick={() => setStep(1)} className="px-6 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors">Back</button>
                     
                     <div className="flex gap-3">
                         <button 
                           onClick={handleSendToEmployee}
                           disabled={quotations.length === 0}
                           className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2 text-sm"
                         >
                             <SendToBack size={16}/> Send to Employee
                         </button>
                         <button 
                           onClick={handleSelectAndSubmit}
                           disabled={!activeQuoteId || !policyCheck || (!policyCheck.compliant && !exceptionReason)}
                           className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm shadow-lg shadow-green-200"
                         >
                             <Save size={16}/> Select & Submit
                         </button>
                     </div>
                   </>
               )}
           </div>
       </div>
    </div>
  );
};