import React, { useState, useEffect } from 'react';
import { 
  X, Mail, DollarSign, CheckCircle, AlertTriangle, 
  Send, Loader2, ArrowRight, FileText, Globe, Clock,
  Plane, Hotel, Car, Shield, Ticket, Pencil, Save, Calendar, MapPin, Eye, ExternalLink, Sparkles, ClipboardPaste, Plus, Trash2
} from 'lucide-react';
import { TravelRequest, RequestStatus, TravelServiceItem, Agency, ServiceType } from '../types';
import { checkPolicyCompliance, parseVendorQuote } from '../services/geminiService';
import { getSLAStatus } from '../services/slaService';
import { storageService } from '../services/storage';

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

  const [localServices, setLocalServices] = useState<TravelServiceItem[]>(
    request.services.map(s => ({...s, actualCost: s.actualCost || 0}))
  );
  
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [tempService, setTempService] = useState<TravelServiceItem | null>(null);

  const [policyCheck, setPolicyCheck] = useState<{ compliant: boolean; message: string; flags: string[] } | null>(null);
  const [exceptionReason, setExceptionReason] = useState(request.policyExceptionReason || '');
  
  const totalActualCost = localServices.reduce((sum, s) => sum + (s.actualCost || 0), 0);
  const sla = getSLAStatus(request.slaDeadline, request.status);

  // Sync state when request prop updates (e.g. after Step 1 save)
  useEffect(() => {
    setSentAgencyLog(request.sentToAgencies || []);
  }, [request.sentToAgencies]);

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
      setSentAgencyLog(newSentLog); // Update local state immediately
      
      const updatedReq = {
          ...request,
          status: RequestStatus.QUOTATION_PENDING,
          sentToAgencies: newSentLog,
          vendorQuotationSentAt: new Date().toISOString()
      };
      
      // CRITICAL FIX: keepOpen = true (pass true as 2nd arg)
      onUpdate(updatedReq, true); 
      
      setSendingStatus('');
      setIsLoading(false);
      setStep(2); // Move to next step without closing
  };

  const handleParseQuote = async () => {
      if (!emailInput.trim()) return;
      setIsParsing(true);
      try {
          const parsedItems = await parseVendorQuote(emailInput);
          const updatedServices = [...localServices];
          parsedItems.forEach(pItem => {
              const matchIndex = updatedServices.findIndex(s => s.type === pItem.type && (!s.actualCost || s.actualCost === 0));
              if (matchIndex >= 0) {
                  updatedServices[matchIndex] = {
                      ...updatedServices[matchIndex],
                      actualCost: pItem.actualCost,
                      bookingReference: pItem.bookingReference
                  };
              }
          });
          setLocalServices(updatedServices);
      } catch (e) {
          console.error(e);
      } finally {
          setIsParsing(false);
      }
  };

  const handleSaveServiceCost = (id: string, cost: number, ref: string) => {
     setLocalServices(prev => prev.map(s => s.id === id ? { ...s, actualCost: cost, bookingReference: ref } : s));
     setEditingServiceId(null);
  };

  const handleAddService = () => {
      const newSvc: TravelServiceItem = {
          id: `SVC-${Date.now()}`,
          type: 'FLIGHT',
          actualCost: 0,
          bookingReference: '',
          tripType: 'ONE_WAY', from: '', to: '', departureDate: '', flightClass: 'Economy'
      } as any;
      setLocalServices([...localServices, newSvc]);
      setEditingServiceId(newSvc.id);
      setTempService(newSvc);
  };

  const handleDeleteService = (id: string) => {
      if (confirm('Are you sure you want to remove this service?')) {
          setLocalServices(prev => prev.filter(s => s.id !== id));
      }
  };

  const runPolicyCheck = async () => {
     setIsLoading(true);
     const check = await checkPolicyCompliance(
         request.trip.destination, 
         totalActualCost, 
         3,
         request.travelType, 
         request.requestFor
     );
     setPolicyCheck(check);
     setIsLoading(false);
  };

  const handleFinalSubmit = () => {
      const nextStatus = RequestStatus.PENDING_APPROVAL;
      
      const updatedReq: TravelRequest = {
          ...request,
          services: localServices,
          actualCost: totalActualCost,
          status: nextStatus,
          policyExceptionReason: exceptionReason,
          policyFlags: policyCheck?.flags || []
      };
      // Final submit: keepOpen = false (Close modal)
      onUpdate(updatedReq, false); 
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
       <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
           {/* Header */}
           <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <div>
                   <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                       <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                           {step}
                       </span>
                       {step === 1 ? 'Vendor Quotation (RFQ)' : 'Process Quotation & Costing'}
                   </h2>
                   <p className="text-slate-500 text-sm mt-1">Request #{request.id} • {request.trip.destination}</p>
               </div>
               <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 transition-colors">
                   <X size={24} />
               </button>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-y-auto p-6">
               
               {/* STEP 1: SEND RFQ */}
               {step === 1 && (
                   <div className="space-y-6">
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

               {/* STEP 2: INPUT COSTS */}
               {step === 2 && (
                   <div className="space-y-6">
                       
                       {/* AI Parser Input */}
                       <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg">
                           <div className="flex justify-between items-center mb-3">
                               <h3 className="font-bold flex items-center gap-2"><Sparkles className="text-yellow-400" size={18}/> AI Quote Parser</h3>
                               <span className="text-xs bg-white/20 px-2 py-1 rounded text-white/80">Gemini 3 Flash</span>
                           </div>
                           <textarea 
                             className="w-full bg-slate-800 border-none rounded-lg p-3 text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500"
                             rows={3}
                             placeholder="Paste email content here to auto-extract costs..."
                             value={emailInput}
                             onChange={(e) => setEmailInput(e.target.value)}
                           />
                           <div className="flex justify-end mt-3">
                               <button 
                                 onClick={handleParseQuote}
                                 disabled={isParsing || !emailInput}
                                 className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                               >
                                   {isParsing ? <Loader2 className="animate-spin" size={16}/> : <ClipboardPaste size={16}/>}
                                   Extract Data
                               </button>
                           </div>
                       </div>

                       {/* Services Table */}
                       <div className="space-y-4">
                           <div className="flex justify-between items-end">
                               <h3 className="font-bold text-slate-800">Confirm Actual Costs</h3>
                               <button onClick={handleAddService} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors">
                                   <Plus size={14}/> Add Service
                               </button>
                           </div>
                           
                           {localServices.map((svc) => (
                               <div key={svc.id} className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                   <div className="flex items-center gap-3 flex-1">
                                       <div className={`p-2 rounded-lg ${svc.type === 'FLIGHT' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {svc.type === 'FLIGHT' ? <Plane size={20}/> : <Hotel size={20}/>}
                                       </div>
                                       <div className="flex-1">
                                           {editingServiceId === svc.id ? (
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <select 
                                                        value={svc.type} 
                                                        onChange={(e) => setLocalServices(prev => prev.map(s => s.id === svc.id ? {...s, type: e.target.value as any} : s))}
                                                        className="p-1 border rounded text-sm font-bold"
                                                    >
                                                        <option value="FLIGHT">Flight</option>
                                                        <option value="HOTEL">Hotel</option>
                                                        <option value="CAR">Car</option>
                                                        <option value="INSURANCE">Insurance</option>
                                                    </select>
                                                    <input 
                                                        type="text"
                                                        value={svc.type === 'FLIGHT' ? (svc as any).flightNumber : (svc as any).hotelName || (svc as any).location}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setLocalServices(prev => prev.map(s => s.id === svc.id ? {
                                                                ...s, 
                                                                ...(s.type === 'FLIGHT' ? { flightNumber: val } : { hotelName: val })
                                                            } : s));
                                                        }}
                                                        placeholder="Details (Flight No / Hotel)"
                                                        className="p-1 border rounded text-sm w-full"
                                                    />
                                                </div>
                                           ) : (
                                               <>
                                                <div className="font-bold text-slate-800">{svc.type}</div>
                                                <div className="text-xs text-slate-500 max-w-xs truncate">
                                                    {svc.type === 'FLIGHT' 
                                                        ? `${(svc as any).from || 'Origin'}-${(svc as any).to || 'Dest'} (${(svc as any).flightNumber || 'TBD'})` 
                                                        : (svc as any).hotelName || (svc as any).location || 'Details'}
                                                </div>
                                               </>
                                           )}
                                       </div>
                                   </div>

                                   <div className="flex items-center gap-2">
                                       {editingServiceId === svc.id ? (
                                           <div className="flex items-center gap-2">
                                               <input 
                                                 type="text" 
                                                 placeholder="Ref #"
                                                 className="w-20 p-2 border rounded text-sm"
                                                 defaultValue={svc.bookingReference}
                                                 id={`ref-${svc.id}`}
                                               />
                                               <input 
                                                 type="number" 
                                                 className="w-24 p-2 border rounded text-sm font-bold"
                                                 defaultValue={svc.actualCost}
                                                 id={`cost-${svc.id}`}
                                               />
                                               <button 
                                                 onClick={() => {
                                                     const cost = parseFloat((document.getElementById(`cost-${svc.id}`) as HTMLInputElement).value);
                                                     const ref = (document.getElementById(`ref-${svc.id}`) as HTMLInputElement).value;
                                                     handleSaveServiceCost(svc.id, cost, ref);
                                                 }}
                                                 className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                               >
                                                   <CheckCircle size={16}/>
                                               </button>
                                           </div>
                                       ) : (
                                           <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400">Ref: {svc.bookingReference || '-'}</div>
                                                    <div className={`font-bold ${svc.actualCost ? 'text-green-600' : 'text-slate-400'}`}>
                                                        {svc.actualCost ? `฿ ${svc.actualCost.toLocaleString()}` : 'Pending'}
                                                    </div>
                                                </div>
                                                <button onClick={() => setEditingServiceId(svc.id)} className="p-2 text-slate-400 hover:text-blue-600">
                                                    <Pencil size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteService(svc.id)} className="p-2 text-slate-400 hover:text-red-600">
                                                    <Trash2 size={16}/>
                                                </button>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>

                       {/* Total & Policy Check */}
                       <div className="border-t border-slate-100 pt-6">
                           <div className="flex justify-between items-center mb-4">
                               <div className="text-slate-500">Total Actual Cost</div>
                               <div className="text-2xl font-bold text-slate-900">฿ {totalActualCost.toLocaleString()}</div>
                           </div>
                           
                           {policyCheck ? (
                               <div className={`p-4 rounded-xl border ${policyCheck.compliant ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                   <div className="flex items-center gap-2 font-bold mb-1">
                                       {policyCheck.compliant ? <CheckCircle className="text-green-600" size={20}/> : <AlertTriangle className="text-red-600" size={20}/>}
                                       <span className={policyCheck.compliant ? 'text-green-700' : 'text-red-700'}>
                                           {policyCheck.compliant ? 'Policy Compliant' : 'Policy Violation Detected'}
                                       </span>
                                   </div>
                                   {!policyCheck.compliant && (
                                       <div className="mt-2">
                                           <p className="text-sm text-red-600 mb-2">{policyCheck.message}</p>
                                           <textarea 
                                             placeholder="Enter exception reason to proceed..."
                                             className="w-full p-2 border border-red-200 rounded text-sm"
                                             value={exceptionReason}
                                             onChange={e => setExceptionReason(e.target.value)}
                                           />
                                       </div>
                                   )}
                               </div>
                           ) : (
                               <button 
                                 onClick={runPolicyCheck} 
                                 className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
                               >
                                   <Shield size={18}/> Run Final Policy Check
                               </button>
                           )}
                       </div>
                   </div>
               )}

           </div>

           {/* Footer */}
           <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
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
                     <button 
                       onClick={handleFinalSubmit}
                       disabled={!policyCheck || (!policyCheck.compliant && !exceptionReason)}
                       className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                     >
                         <Save size={18}/> Submit for Approval
                     </button>
                   </>
               )}
           </div>
       </div>
    </div>
  );
};