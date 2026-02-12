
import React, { useState, useEffect } from 'react';
import { 
  X, Mail, CheckCircle, AlertTriangle, 
  Send, Loader2, ArrowRight, Eye, Sparkles, ClipboardPaste, Plus, Trash2, Save, SendToBack, Shield
} from 'lucide-react';
import { TravelRequest, RequestStatus, Agency, QuotationOption } from '../types';
import { checkPolicyCompliance, parseVendorQuote } from '../services/geminiService';
import { getSLAStatus } from '../services/slaService';
import { storageService } from '../services/storage';
import { formatCurrency } from '../utils/formatters'; // Shared
import { ServiceIcon } from './common/ServiceIcon'; // Shared

interface ProcessRequestModalProps {
  request: TravelRequest;
  onClose: () => void;
  // Updated signature: accept keepOpen boolean
  onUpdate: (updatedRequest: TravelRequest, keepOpen?: boolean) => void;
}

export const ProcessRequestModal: React.FC<ProcessRequestModalProps> = ({ request, onClose, onUpdate }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<string[]>([]);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [sentAgencyLog, setSentAgencyLog] = useState<string[]>(request.sentToAgencies || []);
  const [sendingStatus, setSendingStatus] = useState<string>('');

  // Quotation Management State
  const [quotations, setQuotations] = useState<QuotationOption[]>(request.quotations || []);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);

  const [policyCheck, setPolicyCheck] = useState<{ compliant: boolean; message: string; flags: string[] } | null>(null);
  const [exceptionReason, setExceptionReason] = useState(request.policyExceptionReason || '');
  
  const sla = getSLAStatus(request.slaDeadline, request.status);

  // Sync state when request prop updates (e.g. after Step 1 save)
  useEffect(() => {
    setSentAgencyLog(request.sentToAgencies || []);
    if (request.quotations) setQuotations(request.quotations);
  }, [request.sentToAgencies, request.quotations]);

  useEffect(() => {
      const loadAgencies = async () => {
        const loaded = await storageService.getAgencies();
        setAgencies(loaded);
        if (selectedAgencyIds.length === 0 && !request.vendorQuotationSentAt) {
            setSelectedAgencyIds(loaded.filter(a => a.isPreferred).map(a => a.id));
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
              services: request.services.map(s => ({ ...s, actualCost: 0 })),
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

  const generateEmailBody = (agencyName: string) => {
      let body = `Dear ${agencyName} Team,\n\nPlease provide a quotation for the following request:\n\n`;
      body += `Request ID: ${request.id}\n`;
      body += `Destination: ${request.trip.destination}\n`;
      body += `Dates: ${request.trip.startDate} to ${request.trip.endDate}\n\n`;
      body += `Services Required:\n`;
      request.services.forEach(s => {
          body += `- ${s.type}: ${s.type === 'FLIGHT' ? (s as any).from + ' to ' + (s as any).to : (s as any).location || 'Details'} \n`;
      });
      body += `\nThank you,\nCDG Travel Team`;
      return body;
  };

  const handleSendEmails = async () => {
      if (selectedAgencyIds.length === 0) return;

      setIsLoading(true);
      setSendingStatus('Opening Mail Client...');
      
      const targets = agencies.filter(a => selectedAgencyIds.includes(a.id));
      const primaryAgency = targets[0];
      
      if (primaryAgency) {
          const subject = `RFQ: Travel Request ${request.id} - ${request.trip.destination}`;
          const body = generateEmailBody(primaryAgency.name);
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

  const handleParseQuote = async () => {
      if (!emailInput.trim()) return;
      setIsParsing(true);
      try {
          const parsedOptions = await parseVendorQuote(emailInput);
          if (parsedOptions.length > 0) {
              setQuotations(prev => [...prev, ...parsedOptions]);
              setActiveQuoteId(parsedOptions[0].id);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsParsing(false);
      }
  };

  const addNewQuoteOption = () => {
      const newQuote: QuotationOption = {
          id: `Q-${Date.now()}`,
          name: `Option ${quotations.length + 1}`,
          totalAmount: 0,
          services: request.services.map(s => ({...s, actualCost: 0})),
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

  const updateActiveQuoteService = (serviceId: string, field: string, value: any) => {
      if (!activeQuoteId) return;
      
      setQuotations(prev => prev.map(q => {
          if (q.id === activeQuoteId) {
              const updatedServices = q.services.map(s => s.id === serviceId ? { ...s, [field]: value } : s);
              const total = updatedServices.reduce((sum, s) => sum + (s.actualCost || 0), 0);
              return { ...q, services: updatedServices, totalAmount: total };
          }
          return q;
      }));
  };

  const updateActiveQuoteName = (name: string) => {
      if (!activeQuoteId) return;
      setQuotations(prev => prev.map(q => q.id === activeQuoteId ? { ...q, name } : q));
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

      // Mark selected
      const finalQuotes = quotations.map(q => ({...q, isSelected: q.id === activeQuoteId}));

      const updatedReq: TravelRequest = {
          ...request,
          quotations: finalQuotes,
          services: selectedQuote.services, // Copy selected option to main services
          actualCost: selectedQuote.totalAmount,
          status: RequestStatus.PENDING_APPROVAL,
          policyExceptionReason: exceptionReason,
          policyFlags: policyCheck?.flags || []
      };
      
      onUpdate(updatedReq, false); 
      onClose();
  };

  const handleSendToEmployee = () => {
      // Send all quotes to employee to choose
      const updatedReq: TravelRequest = {
          ...request,
          quotations: quotations,
          status: RequestStatus.WAITING_EMPLOYEE_SELECTION
      };
      onUpdate(updatedReq, false);
      onClose();
  };

  const activeQuote = quotations.find(q => q.id === activeQuoteId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
           {/* Header */}
           <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                   <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                       <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                           {step}
                       </span>
                       {step === 1 ? 'Vendor Quotation (RFQ)' : 'Process & Compare Quotes'}
                   </h2>
                   <p className="text-slate-500 text-sm mt-1">Request #{request.id} • {request.trip.destination}</p>
               </div>
               <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 transition-colors">
                   <X size={24} />
               </button>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
               
               {/* STEP 1: SEND RFQ */}
               {step === 1 && (
                   <div className="space-y-6 max-w-3xl mx-auto">
                       <div className="flex items-start gap-4 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
                           <Mail className="shrink-0 mt-0.5" size={18}/>
                           <div>
                               <strong>SLA Status: </strong> 
                               <span className={sla?.urgent ? 'text-red-600 font-bold' : 'text-blue-600'}>
                                   {sla?.label || 'Calculating...'}
                               </span>
                               <p className="mt-1 opacity-80">Please select vendors to send the Request for Quotation (RFQ) email.</p>
                           </div>
                       </div>

                       <div>
                           <h3 className="font-bold text-slate-800 mb-3">Select Agencies</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                               {agencies.map(agency => (
                                   <div 
                                     key={agency.id} 
                                     onClick={() => handleToggleAgency(agency.id)}
                                     className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between
                                        ${selectedAgencyIds.includes(agency.id) ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}
                                   >
                                       <div>
                                           <div className="font-bold text-slate-900">{agency.name}</div>
                                           <div className="text-xs text-slate-500">{agency.type} • {agency.email}</div>
                                       </div>
                                       {selectedAgencyIds.includes(agency.id) && <CheckCircle className="text-blue-600" size={20}/>}
                                   </div>
                               ))}
                           </div>
                       </div>

                       {selectedAgencyIds.length > 0 && (
                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                               <button 
                                 onClick={() => setEmailPreviewOpen(!emailPreviewOpen)}
                                 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"
                               >
                                   <Eye size={16}/> Preview Email Content
                               </button>
                               {emailPreviewOpen && (
                                   <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm font-mono text-slate-600 whitespace-pre-wrap">
                                       {generateEmailBody(agencies.find(a => a.id === selectedAgencyIds[0])?.name || 'Vendor')}
                                   </div>
                               )}
                           </div>
                       )}
                   </div>
               )}

               {/* STEP 2: INPUT COSTS & OPTIONS */}
               {step === 2 && (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                       
                       {/* LEFT: Options List & AI Parser */}
                       <div className="space-y-4">
                           {/* AI Parser */}
                           <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                               <div className="flex justify-between items-center mb-2">
                                   <h3 className="font-bold text-sm flex items-center gap-2"><Sparkles className="text-yellow-400" size={16}/> AI Quote Parser</h3>
                               </div>
                               <textarea 
                                 className="w-full bg-slate-800 border-none rounded-lg p-3 text-xs text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500"
                                 rows={3}
                                 placeholder="Paste email content here (e.g. Option 1: ... Option 2: ...)"
                                 value={emailInput}
                                 onChange={(e) => setEmailInput(e.target.value)}
                               />
                               <div className="flex justify-end mt-2">
                                   <button 
                                     onClick={handleParseQuote}
                                     disabled={isParsing || !emailInput}
                                     className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                   >
                                       {isParsing ? <Loader2 className="animate-spin" size={14}/> : <ClipboardPaste size={14}/>}
                                       Extract Options
                                   </button>
                               </div>
                           </div>

                           <div className="flex justify-between items-center">
                               <h3 className="font-bold text-slate-700 text-sm uppercase">Quotation Options</h3>
                               <button onClick={addNewQuoteOption} className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                           </div>

                           <div className="space-y-2 max-h-[400px] overflow-y-auto">
                               {quotations.map(quote => (
                                   <div 
                                       key={quote.id} 
                                       onClick={() => setActiveQuoteId(quote.id)}
                                       className={`p-3 rounded-xl border-2 cursor-pointer transition-all relative group
                                           ${activeQuoteId === quote.id ? 'border-blue-500 bg-white shadow-md' : 'border-transparent bg-white hover:bg-slate-100'}`}
                                   >
                                       <div className="flex justify-between items-center mb-1">
                                           <span className="font-bold text-sm text-slate-800">{quote.name}</span>
                                           <span className="font-mono text-sm font-bold text-green-600">{formatCurrency(quote.totalAmount)}</span>
                                       </div>
                                       <div className="text-xs text-slate-500 truncate">{quote.remark || `${quote.services.length} services`}</div>
                                       
                                       {quotations.length > 1 && (
                                           <button 
                                             onClick={(e) => { e.stopPropagation(); removeQuoteOption(quote.id); }}
                                             className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                           >
                                               <X size={12}/>
                                           </button>
                                       )}
                                   </div>
                               ))}
                           </div>
                       </div>

                       {/* RIGHT: Active Option Details */}
                       <div className="lg:col-span-2 flex flex-col h-full">
                           {activeQuote ? (
                               <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col">
                                   <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl flex justify-between items-center">
                                       <input 
                                           type="text" 
                                           value={activeQuote.name} 
                                           onChange={(e) => updateActiveQuoteName(e.target.value)}
                                           className="bg-transparent font-bold text-lg text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
                                       />
                                       <div className="text-sm text-slate-500">Total: <span className="text-xl font-bold text-slate-900">{formatCurrency(activeQuote.totalAmount)}</span></div>
                                   </div>

                                   <div className="p-4 flex-1 overflow-y-auto space-y-3">
                                       {activeQuote.services.map((svc, idx) => (
                                           <div key={svc.id} className="border border-slate-100 rounded-lg p-3 flex gap-3 items-start">
                                               <div className={`p-2 rounded-lg shrink-0 ${svc.type === 'FLIGHT' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                                    <ServiceIcon type={svc.type} size={18}/>
                                               </div>
                                               <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Details</label>
                                                       <input 
                                                           type="text" 
                                                           value={svc.type === 'FLIGHT' ? (svc as any).flightNumber : (svc as any).hotelName}
                                                           onChange={(e) => updateActiveQuoteService(svc.id, svc.type === 'FLIGHT' ? 'flightNumber' : 'hotelName', e.target.value)}
                                                           placeholder={svc.type === 'FLIGHT' ? 'Flight No.' : 'Hotel Name'}
                                                           className="w-full text-sm font-medium border-b border-slate-200 focus:border-blue-500 outline-none py-1"
                                                       />
                                                   </div>
                                                   <div className="flex gap-2">
                                                       <div className="flex-1">
                                                           <label className="text-[10px] font-bold text-slate-400 uppercase">Cost (THB)</label>
                                                           <input 
                                                               type="number" 
                                                               value={svc.actualCost}
                                                               onChange={(e) => updateActiveQuoteService(svc.id, 'actualCost', parseFloat(e.target.value))}
                                                               className="w-full text-sm font-bold border-b border-slate-200 focus:border-blue-500 outline-none py-1 text-right"
                                                           />
                                                       </div>
                                                       <div className="flex-1">
                                                           <label className="text-[10px] font-bold text-slate-400 uppercase">Ref #</label>
                                                           <input 
                                                               type="text" 
                                                               value={svc.bookingReference || ''}
                                                               onChange={(e) => updateActiveQuoteService(svc.id, 'bookingReference', e.target.value)}
                                                               className="w-full text-sm border-b border-slate-200 focus:border-blue-500 outline-none py-1"
                                                           />
                                                       </div>
                                                   </div>
                                               </div>
                                           </div>
                                       ))}
                                   </div>

                                   {/* Policy Check per Option */}
                                   <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                                       {policyCheck ? (
                                           <div className={`flex items-start gap-3 p-3 rounded-lg border ${policyCheck.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                               {policyCheck.compliant ? <CheckCircle className="text-green-600 mt-0.5" size={18}/> : <AlertTriangle className="text-red-600 mt-0.5" size={18}/>}
                                               <div className="flex-1">
                                                   <div className={`text-sm font-bold ${policyCheck.compliant ? 'text-green-700' : 'text-red-700'}`}>
                                                       {policyCheck.compliant ? 'Policy Compliant' : 'Policy Violation'}
                                                   </div>
                                                   {!policyCheck.compliant && (
                                                       <>
                                                           <p className="text-xs text-red-600 mt-1">{policyCheck.message}</p>
                                                           <textarea 
                                                               placeholder="Exception Reason..." 
                                                               value={exceptionReason}
                                                               onChange={(e) => setExceptionReason(e.target.value)}
                                                               className="w-full mt-2 p-2 text-xs border rounded"
                                                           />
                                                       </>
                                                   )}
                                               </div>
                                               <button onClick={() => setPolicyCheck(null)} className="text-slate-400 hover:text-slate-600"><X size={14}/></button>
                                           </div>
                                       ) : (
                                           <button onClick={runPolicyCheck} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                                               <Shield size={14}/> Check Policy for this Option
                                           </button>
                                       )}
                                   </div>
                               </div>
                           ) : (
                               <div className="flex items-center justify-center h-full text-slate-400">Select an option to edit</div>
                           )}
                       </div>
                   </div>
               )}

           </div>

           {/* Footer Actions */}
           <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
               {step === 1 ? (
                   <>
                     <button onClick={onClose} className="px-6 py-3 text-slate-500 hover:bg-slate-200 rounded-xl font-bold">Cancel</button>
                     
                     {request.status === RequestStatus.QUOTATION_PENDING ? (
                        <button 
                            onClick={() => setStep(2)} 
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 flex items-center gap-2"
                        >
                            Skip to Quotation <ArrowRight size={18}/>
                        </button>
                     ) : (
                        <button 
                            onClick={handleSendEmails} 
                            disabled={selectedAgencyIds.length === 0 || isLoading}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                            {isLoading ? sendingStatus : 'Open Mail Client'}
                        </button>
                     )}
                   </>
               ) : (
                   <>
                     <button onClick={() => setStep(1)} className="px-6 py-3 text-slate-500 hover:bg-slate-200 rounded-xl font-bold">Back</button>
                     
                     <div className="flex gap-3">
                         <button 
                           onClick={handleSendToEmployee}
                           disabled={quotations.length === 0}
                           className="px-6 py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-xl font-bold hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                         >
                             <SendToBack size={18}/> Send to Employee
                         </button>
                         <button 
                           onClick={handleSelectAndSubmit}
                           disabled={!activeQuoteId || !policyCheck || (!policyCheck.compliant && !exceptionReason)}
                           className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                         >
                             <Save size={18}/> Select & Submit
                         </button>
                     </div>
                   </>
               )}
           </div>
       </div>
    </div>
  );
};
