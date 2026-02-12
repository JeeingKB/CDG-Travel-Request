
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Sparkles, FileText, Camera, Check, Loader2, MessageCircle, MapPin, Calendar, ArrowRight, Plane, User, Paperclip, Download, BarChart2, ShieldAlert, GitMerge, FileCheck, Edit, Clock } from 'lucide-react';
import { parseTravelIntent, analyzeReceiptImage } from '../services/geminiService';
import { validatePolicy, getApprovalFlow } from '../services/policyRules';
import { ChatMessage, TravelRequest, TravelType, RequestStatus, TravelerDetails } from '../types';
import { useTranslation } from '../services/translations';
import { storageService } from '../services/storage';

interface ChatAssistantProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDraftRequest: (data: any) => void;
  onCreateRequest: (data: any) => Promise<TravelRequest>; 
  onUpdateStatus: (id: string, status: string) => Promise<TravelRequest | null>; 
  existingRequests: TravelRequest[]; 
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ isOpen, onOpen, onClose, onDraftRequest, onCreateRequest, onUpdateStatus, existingRequests }) => {
  const { t, language } = useTranslation();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const QUICK_ACTIONS = [
    { label: t('chat.quick.stats'), prompt: "My Stats" },
    { label: t('chat.quick.policy'), prompt: "Check Policy" },
    { label: t('chat.quick.create'), prompt: "New Request" },
  ];

  // Reset/Init welcome message when language changes or chat opens
  useEffect(() => {
      if (messages.length === 0 || messages[0].id === 'welcome') {
          setMessages(prev => {
              const newWelcome: ChatMessage = {
                  id: 'welcome',
                  role: 'assistant',
                  text: t('chat.welcome'),
                  timestamp: new Date()
              };
              if (prev.length > 0 && prev[0].id === 'welcome') {
                  return [newWelcome, ...prev.slice(1)];
              }
              return [newWelcome];
          });
      }
  }, [language, isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle "Quick Submit" from Chat
  const handleQuickSubmit = async (msgId: string, data: any) => {
      setSubmittingId(msgId);
      try {
          const createdRequest = await onCreateRequest(data);
          await new Promise(r => setTimeout(r, 1000)); // Sim network

          setMessages(prev => prev.map(m => {
              if (m.id === msgId) {
                  return {
                      ...m,
                      action: undefined, // Remove action buttons
                      text: "✅ " + t('submit') + " Success!",
                  };
              }
              return m;
          }));

          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              text: t('chat.slip.title'),
              timestamp: new Date(),
              data: { submittedRequest: createdRequest },
              type: 'text'
          }]);

      } catch (error) {
          console.error(error);
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              text: t('chat.error'),
              timestamp: new Date()
          }]);
      } finally {
          setSubmittingId(null);
      }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Get User Context
      const employees = await storageService.getEmployees();
      const currentUser: TravelerDetails = employees[0] || { 
        id: 'GUEST', 
        name: 'Guest', 
        department: 'General',
        title: 'Mr.',
        type: 'Guest'
      };

      // Pass current language and user context to AI
      const result = await parseTravelIntent(textToSend, existingRequests, language, currentUser);
      
      let responseText = t('chat.error');
      let action: 'DRAFT_CREATED' | undefined = undefined;
      let draftData = null;
      let generatedDoc = null;
      let additionalInfo = {};
      let statusRequests: TravelRequest[] = [];
      let updatedStatusRequest: TravelRequest | undefined = undefined;

      if (result) {
          responseText = result.conversationalResponse || responseText;
          draftData = result.travelRequest;
          generatedDoc = result.generatedDocument;
          
          if (result.intent === 'CHECK_STATUS' && result.statusResults) {
             statusRequests = result.statusResults;
          }

          if (result.intent === 'CREATE_REQUEST' && draftData && draftData.trip?.destination) {
             action = 'DRAFT_CREATED';
             
             // Dynamic User Simulation for DOA Check in Chat
             const estCost = draftData.estimatedCost || 20000;
             const type = draftData.travelType || TravelType.DOMESTIC;
             const doa = getApprovalFlow(currentUser as any, estCost);
             let policyStatus = 'Pass';
             if (type === TravelType.DOMESTIC && estCost > 30000) policyStatus = 'Warning';
             additionalInfo = { doa, policyStatus };
          }

          if (result.intent === 'UPDATE_STATUS' && result.statusUpdate) {
              const updated = await onUpdateStatus(result.statusUpdate.requestId, result.statusUpdate.status);
              if (updated) {
                  updatedStatusRequest = updated;
              } else {
                  responseText += `\n(Could not find Request ID: ${result.statusUpdate.requestId})`;
              }
          }
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: responseText,
        timestamp: new Date(),
        action: action,
        data: { 
            ...draftData, 
            generatedDoc, 
            ...additionalInfo,
            statusList: statusRequests,
            submittedRequest: updatedStatusRequest 
        } as any 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        text: t('chat.error'),
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const isImage = file.type.startsWith('image/');
    const url = URL.createObjectURL(file);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: isImage ? '' : `[Attached: ${file.name}]`,
      timestamp: new Date(),
      attachment: { name: file.name, url: url, type: isImage ? 'image' : 'file' }
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    try {
        if (isImage) {
            // Call Real Gemini Vision API
            const ocrResult = await analyzeReceiptImage(file);
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: `📸 **Receipt Analyzed**\nMerchant: ${ocrResult.merchant}\nTotal: ${ocrResult.amount} ${ocrResult.currency}\nDate: ${ocrResult.date}`,
                timestamp: new Date(),
                type: 'receipt_analysis',
                action: 'EXPENSE_ADDED',
                data: ocrResult
            };
            setMessages(prev => [...prev, aiMsg]);
        } else {
             const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: `📎 Received "${file.name}". I can only analyze images for receipts currently.`,
                timestamp: new Date()
            };
            setTimeout(() => { setMessages(prev => [...prev, aiMsg]); setIsLoading(false); }, 1000);
        }
    } catch (error) { 
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            text: "❌ Failed to analyze image. Please try another one.",
            timestamp: new Date()
        }]);
        setIsLoading(false); 
    }
  };

  const triggerFileInput = (accept: string) => {
    if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- RENDER COMPONENT: Request Slip ---
  const renderRequestSlip = (req: TravelRequest) => (
      <div className="mt-4 relative bg-white rounded-xl border border-slate-300 shadow-md overflow-hidden max-w-[280px]">
          <div className={`px-4 py-3 flex justify-between items-center text-white
              ${req.status === RequestStatus.APPROVED ? 'bg-green-600' :
                req.status === RequestStatus.SUBMITTED ? 'bg-blue-600' :
                req.status === RequestStatus.REJECTED ? 'bg-red-600' :
                'bg-slate-700'}`}>
              <div className="flex items-center gap-2">
                  <FileCheck size={16} />
                  <span className="font-bold text-xs tracking-wide uppercase">{t('chat.slip.title')}</span>
              </div>
          </div>
          
          <div className="p-4 bg-slate-50 space-y-3 relative">
              <div className="absolute -left-2 top-1/2 w-4 h-4 bg-white rounded-full border border-slate-300 transform -translate-y-1/2"></div>
              <div className="absolute -right-2 top-1/2 w-4 h-4 bg-white rounded-full border border-slate-300 transform -translate-y-1/2"></div>
              
              <div className="flex justify-between items-start border-b border-dashed border-slate-300 pb-3">
                   <div>
                       <div className="text-[10px] text-slate-500 uppercase font-bold">{t('chat.slip.id')}</div>
                       <div className="font-mono text-sm font-bold text-slate-800">{req.id}</div>
                   </div>
                   <div className="text-right">
                       <div className="text-[10px] text-slate-500 uppercase font-bold">{t('chat.slip.status')}</div>
                       <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase
                           ${req.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-700' :
                             req.status === RequestStatus.SUBMITTED ? 'bg-blue-100 text-blue-700' :
                             req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' :
                             'bg-orange-100 text-orange-700'}`}>
                           {req.status}
                       </span>
                   </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                  <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">{t('chat.slip.dest')}</div>
                      <div className="text-sm font-bold text-slate-800 truncate">{req.trip.destination}</div>
                  </div>
                  <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">{t('chat.slip.cost')}</div>
                      <div className="text-sm font-bold text-slate-800">฿ {req.estimatedCost.toLocaleString()}</div>
                  </div>
                  <div className="col-span-2">
                       <div className="text-[10px] text-slate-500 uppercase font-bold">{t('chat.slip.date')}</div>
                       <div className="text-xs text-slate-700 flex items-center gap-1">
                           <Calendar size={12}/> {req.trip.startDate} <ArrowRight size={10}/> {req.trip.endDate}
                       </div>
                  </div>
              </div>
          </div>
          
          <div className="bg-white p-2 flex justify-center opacity-40">
               <div className="h-4 w-full bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Barcode_Code_128B.svg/1200px-Barcode_Code_128B.svg.png')] bg-cover bg-center"></div>
          </div>
      </div>
  );

  if (!isOpen) {
    return (
      <button
        onClick={onOpen}
        className="fixed bottom-8 right-8 w-16 h-16 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl flex items-center justify-center z-50 transition-all hover:scale-110 active:scale-95 group animate-fade-in-up"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full opacity-40 group-hover:opacity-75 blur transition duration-500"></div>
        <div className="relative flex items-center justify-center w-full h-full bg-slate-900 rounded-full border border-slate-700">
           <Sparkles size={28} className="text-blue-400 group-hover:text-white transition-colors" />
           <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-slate-900 rounded-full"></span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[650px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 animate-fade-in-up overflow-hidden font-sans">
      <div className="bg-slate-900 p-4 flex justify-between items-center text-white cursor-pointer" onClick={onClose}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{t('chat.title')}</h3>
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              {t('chat.online')}
            </span>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-slate-900 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'}`}>
              
              {msg.attachment && (
                <div className="mb-2">
                    {msg.attachment.type === 'image' ? (
                        <div className="rounded-lg overflow-hidden border border-slate-700/20">
                            <img src={msg.attachment.url} alt="attachment" className="w-full h-auto max-h-48 object-cover" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-2 bg-slate-800/10 rounded-lg text-current">
                            <FileText size={16} />
                            <span className="text-xs underline truncate max-w-[150px]">{msg.attachment.name}</span>
                        </div>
                    )}
                </div>
              )}

              {msg.text && <p className="whitespace-pre-line">{msg.text}</p>}
              
              {msg.action === 'DRAFT_CREATED' && msg.data?.trip && (
                <div className="mt-3 bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                  <div className="bg-blue-50 px-3 py-2 flex justify-between items-center border-b border-blue-100">
                     <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">{t('chat.draft.review')}</span>
                     <Plane size={12} className="text-blue-400"/>
                  </div>
                  <div className="p-3 space-y-2">
                      <div className="flex justify-between">
                          <div>
                              <div className="text-xs text-slate-500">{t('chat.slip.dest')}</div>
                              <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                 <MapPin size={12} className="text-blue-500" />
                                 {(msg.data as any).trip?.destination}
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="text-xs text-slate-500">{t('chat.slip.cost')}</div>
                              <div className="text-sm font-bold text-slate-800">฿ {((msg.data as any).estimatedCost || 0).toLocaleString()}</div>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                          <button 
                            onClick={() => onDraftRequest(msg.data)}
                            className="bg-white border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-50 transition-colors"
                          >
                             <Edit size={12}/> {t('chat.draft.edit')}
                          </button>
                          <button 
                            onClick={() => handleQuickSubmit(msg.id, msg.data)}
                            disabled={submittingId === msg.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                          >
                             {submittingId === msg.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12} />}
                             {t('chat.draft.submit')}
                          </button>
                      </div>
                  </div>
                </div>
              )}

              {msg.data?.submittedRequest && renderRequestSlip(msg.data.submittedRequest)}

              {(msg.data as any)?.statusList && ((msg.data as any).statusList as TravelRequest[]).map((req, idx) => (
                  <div key={idx} onClick={() => onDraftRequest(req)} className="cursor-pointer"> 
                    {renderRequestSlip(req)}
                  </div>
              ))}

              {msg.data?.generatedDoc && (
                 <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between group cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                           <FileText size={18}/>
                        </div>
                        <div>
                           <div className="text-sm font-bold text-slate-800">{msg.data.generatedDoc.name || 'Doc.pdf'}</div>
                           <div className="text-[10px] text-slate-500">{msg.data.generatedDoc.type} • 1.2 MB</div>
                        </div>
                    </div>
                    <button className="text-slate-400 hover:text-blue-600 p-2"><Download size={18}/></button>
                 </div>
              )}

              <span className="text-[10px] opacity-50 mt-1 block text-right">
                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
           <div className="flex justify-start">
             <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
               <Loader2 className="animate-spin text-blue-500" size={18} />
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-slate-100">
        <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar border-b border-slate-50">
            {QUICK_ACTIONS.map((action, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSend(action.prompt)}
                  className="whitespace-nowrap px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-full text-xs font-medium border border-slate-200 transition-colors"
                >
                   {action.label}
                </button>
            ))}
        </div>

        <div className="p-3 pb-4">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelect} 
            />
            <div className="relative flex gap-2">
            <button 
                onClick={() => triggerFileInput('*/*')}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"
            >
                <Paperclip size={20} />
            </button>
            <button 
                onClick={() => triggerFileInput('image/*')}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"
            >
                <Camera size={20} />
            </button>
            <div className="relative flex-1">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.placeholder')}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm placeholder:text-slate-400"
                />
                <button 
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-2 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                    <Send size={16} />
                </button>
            </div>
            </div>
        </div>
      </div>
    </div>
  );
};
