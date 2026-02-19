
import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle, Plane, Hotel, Car, FileText, Building } from 'lucide-react';
import { TravelRequest, Agency } from '../types';
import { storageService } from '../services/storage';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ServiceIcon } from './common/ServiceIcon';

interface BookingConfirmationModalProps {
  request: TravelRequest;
  onClose: () => void;
  onConfirm: (req: TravelRequest) => void;
}

export const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({ request, onClose, onConfirm }) => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('');
  const [emailBody, setEmailBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const selectedQuote = request.quotations?.find(q => q.isSelected);

  useEffect(() => {
    const loadAgencies = async () => {
      const allAgencies = await storageService.getAgencies();
      // Filter agencies that were originally contacted if possible, else show all
      const relevantAgencies = request.sentToAgencies && request.sentToAgencies.length > 0
        ? allAgencies.filter(a => request.sentToAgencies?.includes(a.id))
        : allAgencies;
      
      setAgencies(relevantAgencies);
      if (relevantAgencies.length > 0) setSelectedAgencyId(relevantAgencies[0].id);
    };
    loadAgencies();
  }, [request]);

  useEffect(() => {
    if (selectedAgencyId && selectedQuote) {
        const agency = agencies.find(a => a.id === selectedAgencyId);
        const text = generateBookingEmail(agency?.name || 'Partner', request, selectedQuote);
        setEmailBody(text);
    }
  }, [selectedAgencyId, selectedQuote, agencies]);

  const generateBookingEmail = (agencyName: string, req: TravelRequest, quote: any) => {
      return `Dear ${agencyName} Team,

Please proceed with the **CONFIRMED BOOKING** for the following option:

Request ID: ${req.id}
Traveler: ${req.travelers.map(t => t.name).join(', ')}
Option: ${quote.name}
Total Cost: ${formatCurrency(quote.totalAmount)}

Services:
${quote.services.map((s: any) => {
    let details = `- ${s.type}: ${s.type === 'FLIGHT' ? s.flightNumber : s.hotelName} (${s.type === 'FLIGHT' ? s.from + '-' + s.to : s.location})`;
    // Append Assignments
    if (s.assignedTravelerIds && s.assignedTravelerIds.length > 0) {
        const assignedNames = req.travelers.filter((t: any) => s.assignedTravelerIds.includes(t.id)).map((t: any) => t.name).join(', ');
        details += ` [Passenger: ${assignedNames}]`;
    }
    return details;
}).join('\n')}

Please issue tickets/vouchers and send the invoice to CDG Finance.

Thank you,
CDG Admin Team`;
  };

  const handleConfirm = async () => {
      setIsSending(true);
      // Simulate API call/Email
      const agency = agencies.find(a => a.id === selectedAgencyId);
      if (agency) {
          window.location.href = `mailto:${agency.email}?subject=Booking Confirmation: ${request.id}&body=${encodeURIComponent(emailBody)}`;
      }
      
      await new Promise(r => setTimeout(r, 1000));
      onConfirm(request);
      setIsSending(false);
  };

  if (!selectedQuote) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg text-white">
                    <CheckCircle size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold">Confirm Booking</h2>
                    <p className="text-sm text-slate-300 opacity-80">Request #{request.id} • Approved by Manager</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-6">
            
            {/* Selected Option Summary */}
            <div className="bg-white p-5 rounded-xl border-2 border-blue-100 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600"/> Confirmed Option
                </h3>
                <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                    <div>
                        <div className="text-lg font-bold text-slate-900">{selectedQuote.name}</div>
                        <div className="text-xs text-slate-500">{request.travelers.length} Travelers • {request.trip.destination}</div>
                    </div>
                    <div className="text-xl font-bold text-green-700">{formatCurrency(selectedQuote.totalAmount)}</div>
                </div>
                <div className="space-y-2">
                    {selectedQuote.services.map((svc: any, idx: number) => (
                        <div key={idx} className="flex flex-col gap-1 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-3">
                                <ServiceIcon type={svc.type} size={16} className="text-slate-400"/>
                                <span className="font-bold">{svc.type === 'FLIGHT' ? svc.flightNumber : svc.hotelName}</span>
                                <span className="text-slate-400">|</span>
                                <span>{svc.type === 'FLIGHT' ? `${formatDate(svc.departureDate)}` : `${formatDate(svc.checkIn)}`}</span>
                            </div>
                            {svc.assignedTravelerIds && svc.assignedTravelerIds.length > 0 && (
                                <div className="text-xs text-slate-500 pl-7">
                                    Passengers: {request.travelers.filter((t: any) => svc.assignedTravelerIds.includes(t.id)).map((t: any) => t.name).join(', ')}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Agency Selection */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Select Agency to Send Booking Order</label>
                <div className="relative">
                    <Building className="absolute left-3 top-3 text-slate-400" size={18}/>
                    <select 
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none appearance-none"
                        value={selectedAgencyId}
                        onChange={(e) => setSelectedAgencyId(e.target.value)}
                    >
                        {agencies.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Email Preview */}
            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email Preview</label>
                <textarea 
                    className="w-full h-40 bg-white border border-slate-300 rounded-lg p-3 text-sm font-mono text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                />
            </div>

        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">
                Cancel
            </button>
            <button 
                onClick={handleConfirm}
                disabled={isSending || !selectedAgencyId}
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 shadow-lg"
            >
                {isSending ? 'Sending...' : 'Confirm & Send Email'}
                <Send size={18}/>
            </button>
        </div>

      </div>
    </div>
  );
};
