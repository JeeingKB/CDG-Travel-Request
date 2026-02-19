
import React, { useState } from 'react';
import { X, CheckCircle, Info } from 'lucide-react';
import { TravelRequest } from '../types';
import { formatCurrency } from '../utils/formatters'; // Shared
import { ServiceIcon } from './common/ServiceIcon'; // Shared
import { workflowService } from '../services/workflowService';
import { useAuth } from '../contexts/AuthContext';

interface QuotationSelectionModalProps {
  request: TravelRequest;
  onClose: () => void;
  onSelect: (request: TravelRequest, optionId: string) => void;
}

export const QuotationSelectionModal: React.FC<QuotationSelectionModalProps> = ({ request, onClose, onSelect }) => {
  const { employeeDetails } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!request.quotations || request.quotations.length === 0) {
      return null;
  }

  const handleConfirm = () => {
      if (selectedId && employeeDetails) {
          // Initialize chain before passing back to parent
          const selectedOption = request.quotations?.find(q => q.id === selectedId);
          if (selectedOption) {
              const reqWithChain = workflowService.initializeApprovalChain(request, employeeDetails, selectedOption.totalAmount);
              onSelect(reqWithChain, selectedId);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
            <div>
                <h2 className="text-xl font-bold">Select Travel Option</h2>
                <p className="text-sm text-slate-300 opacity-80">Request #{request.id} • Please choose your preferred option</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {request.quotations.map((quote) => (
                    <div 
                        key={quote.id}
                        onClick={() => setSelectedId(quote.id)}
                        className={`relative rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden flex flex-col
                            ${selectedId === quote.id ? 'border-blue-600 bg-white shadow-xl ring-4 ring-blue-100 scale-[1.02]' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                    >
                        {selectedId === quote.id && (
                            <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded-bl-xl flex items-center gap-1">
                                <CheckCircle size={12}/> SELECTED
                            </div>
                        )}

                        <div className="p-5 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-900">{quote.name}</h3>
                            <div className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(quote.totalAmount)}</div>
                            {quote.remark && <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded">{quote.remark}</p>}
                        </div>

                        <div className="p-5 space-y-4 flex-1">
                            {quote.services.map((svc, idx) => (
                                <div key={idx} className="flex gap-3 items-start">
                                    <div className={`p-2 rounded-lg shrink-0 ${svc.type === 'FLIGHT' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                        <ServiceIcon type={svc.type} size={16}/>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase">{svc.type}</div>
                                        <div className="text-sm font-semibold text-slate-800">
                                            {svc.type === 'FLIGHT' ? (svc as any).flightNumber : (svc as any).hotelName}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {svc.type === 'FLIGHT' ? `${(svc as any).from} - ${(svc as any).to}` : (svc as any).location}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">
                Decide Later
            </button>
            <button 
                onClick={handleConfirm}
                disabled={!selectedId}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
            >
                Confirm Selection
            </button>
        </div>

      </div>
    </div>
  );
};
