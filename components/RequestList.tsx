
import React, { useState } from 'react';
import { Search, Filter, Pencil, Trash2, Plane, Users, ChevronRight, Eye, Calendar, MapPin } from 'lucide-react';
import { TravelRequest, RequestStatus, RequestFor } from '../types';
import { useTranslation } from '../services/translations';

interface RequestListProps {
  requests: TravelRequest[];
  onEdit: (req: TravelRequest) => void;
  onDelete: (id: string) => void;
}

export const RequestList: React.FC<RequestListProps> = ({ requests, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  // Filter Logic
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
        req.trip.destination.toLowerCase().includes(searchTerm.toLowerCase()) || 
        req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requesterName.toLowerCase().includes(searchTerm.toLowerCase());
        
    const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'ACTIVE' ? (req.status !== RequestStatus.COMPLETED && req.status !== RequestStatus.REJECTED && req.status !== RequestStatus.BOOKED) :
        (req.status === RequestStatus.COMPLETED || req.status === RequestStatus.REJECTED || req.status === RequestStatus.BOOKED);
        
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('reqList.title')}</h1>
          <p className="text-slate-500 mt-1">{t('reqList.subtitle')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
         
         {/* Search */}
         <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder={t('reqList.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
            />
         </div>

         {/* Filter Tabs */}
         <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-auto">
             {['ALL', 'ACTIVE', 'COMPLETED'].map((tab) => (
                 <button
                    key={tab}
                    onClick={() => setStatusFilter(tab as any)}
                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-bold transition-all
                        ${statusFilter === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                     {t(`reqList.filter.${tab.toLowerCase()}`)}
                 </button>
             ))}
         </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">{t('dash.table.id')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">{t('dash.table.detail')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">{t('dash.table.type')}</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">{t('dash.table.status')}</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">{t('dash.table.cost')}</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">{t('dash.table.actions')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => onEdit(req)}>
                            <td className="px-6 py-4">
                                <span className="font-mono text-sm font-semibold text-slate-700">{req.id}</span>
                                <div className="text-[10px] text-slate-400 mt-0.5">Created {new Date(req.submittedAt || Date.now()).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                        <MapPin size={18}/>
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{req.trip.destination}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Calendar size={10}/> {req.trip.startDate} - {req.trip.endDate}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${req.travelType === 'INTERNATIONAL' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {req.travelType === 'INTERNATIONAL' ? t('common.international') : t('common.domestic')}
                                    </span>
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <Users size={10}/> {t(`common.${req.requestFor.toLowerCase()}`)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold
                                    ${req.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-700' : 
                                    req.status === RequestStatus.PENDING_APPROVAL ? 'bg-orange-100 text-orange-700' : 
                                    req.status === RequestStatus.SUBMITTED ? 'bg-blue-100 text-blue-700' :
                                    req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' :
                                    'bg-slate-100 text-slate-600'}`}>
                                    {t(`status.${req.status}`)}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                {req.actualCost ? (
                                    <div className="flex flex-col items-end">
                                        <span className="font-bold text-green-700 text-sm">฿ {req.actualCost.toLocaleString()}</span>
                                        <span className="text-[10px] text-slate-400 line-through">Est: ฿ {req.estimatedCost.toLocaleString()}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm font-semibold text-slate-600">฿ {Number(req.estimatedCost).toLocaleString()}</span>
                                )}
                            </td>
                            <td className="px-6 py-4 text-right relative z-20">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onEdit(req); }}
                                        className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 rounded-lg transition-all shadow-sm"
                                        title="View/Edit"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onDelete(req.id); }}
                                        className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 rounded-lg transition-all shadow-sm"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredRequests.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <Search size={20} className="text-slate-300"/>
                                    </div>
                                    <p>{t('reqList.empty')}</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};
