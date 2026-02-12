
import React, { useState } from 'react';
import { X, Check, XCircle, CornerUpLeft, Calendar, MapPin, DollarSign } from 'lucide-react';
import { TravelRequest } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters'; // Shared

interface ApprovalModalProps {
  request: TravelRequest;
  onClose: () => void;
  onApprove: (req: TravelRequest) => void;
  onReject: (req: TravelRequest, reason: string) => void;
  onSendBack: (req: TravelRequest, reason: string) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({ request, onClose, onApprove, onReject, onSendBack }) => {
    const [reason, setReason] = useState('');
    const [action, setAction] = useState<'REJECT' | 'SENDBACK' | null>(null);

    const handleConfirmAction = () => {
        if (action === 'REJECT') {
            onReject(request, reason);
        } else if (action === 'SENDBACK') {
            onSendBack(request, reason);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Approval Request</h2>
                        <p className="text-sm text-slate-500">{request.id} • {request.requesterName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Destination</div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                <MapPin size={16} className="text-blue-500"/> {request.trip.destination}
                            </div>
                        </div>
                         <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Total Cost</div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                <DollarSign size={16} className="text-green-500"/> {formatCurrency(request.actualCost || request.estimatedCost)}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Dates</div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                <Calendar size={16} className="text-orange-500"/> {formatDate(request.trip.startDate)} - {formatDate(request.trip.endDate)}
                            </div>
                        </div>
                         <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Justification</div>
                            <div className="font-medium text-slate-800 text-sm">
                                {request.trip.justification || 'No justification provided.'}
                            </div>
                        </div>
                    </div>

                    {/* Policy Flags */}
                    {request.policyFlags && request.policyFlags.length > 0 && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                            <h3 className="text-sm font-bold text-red-700 mb-2">Policy Warnings</h3>
                            <ul className="list-disc list-inside text-sm text-red-600">
                                {request.policyFlags.map((flag, idx) => (
                                    <li key={idx}>{flag}</li>
                                ))}
                            </ul>
                            {request.policyExceptionReason && (
                                <div className="mt-2 text-sm text-slate-600">
                                    <strong>Exception Reason:</strong> {request.policyExceptionReason}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Input Area (Conditional) */}
                    {action && (
                        <div className="mb-6 animate-fade-in">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                {action === 'REJECT' ? 'Reason for Rejection' : 'Reason for Sending Back'}
                            </label>
                            <textarea 
                                autoFocus
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                                rows={3}
                                placeholder="Please provide details..."
                            />
                        </div>
                    )}
                    
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    {!action ? (
                        <>
                            <button 
                                onClick={() => setAction('SENDBACK')}
                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 flex items-center gap-2"
                            >
                                <CornerUpLeft size={18}/> Send Back
                            </button>
                            <button 
                                onClick={() => setAction('REJECT')}
                                className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 flex items-center gap-2"
                            >
                                <XCircle size={18}/> Decline
                            </button>
                            <button 
                                onClick={() => onApprove(request)}
                                className="px-6 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-200"
                            >
                                <Check size={18}/> Approve
                            </button>
                        </>
                    ) : (
                        <>
                             <button 
                                onClick={() => { setAction(null); setReason(''); }}
                                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-200 rounded-xl"
                            >
                                Cancel
                            </button>
                             <button 
                                onClick={handleConfirmAction}
                                disabled={!reason.trim()}
                                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50"
                            >
                                Confirm {action === 'REJECT' ? 'Decline' : 'Send Back'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
