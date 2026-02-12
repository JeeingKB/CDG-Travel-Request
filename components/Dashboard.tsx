
import React, { useState, useMemo } from 'react';
import { 
    Plus, Plane, FileText, CheckCircle, Clock, Inbox, Mail, 
    AlertTriangle, ArrowRight, ShieldCheck, Download, Printer, 
    FileSpreadsheet, FileJson, ChevronDown, Users, Pencil, Trash2, FileSearch, MousePointerClick
} from 'lucide-react';
import { StatCard } from './StatCard';
import { TravelRequest, RequestStatus, RequestFor, UserRole } from '../types';
import { getSLAStatus } from '../services/slaService';
import { exportService } from '../services/exportService';
import { useTranslation } from '../services/translations';
import { StatusBadge } from './common/StatusBadge'; // NEW: Shared Component
import { formatCurrency, formatDate, formatRequestId } from '../utils/formatters'; // NEW: Shared Functions
import { getTravelTypeStyle } from '../utils/styleHelpers'; // NEW: Shared Logic

// --- Print Components ---

const PrintSingleTicket: React.FC<{ request: TravelRequest }> = ({ request }) => {
  return (
    <div className="p-8 border border-slate-300 max-w-3xl mx-auto font-serif bg-white text-black">
      <div className="text-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold uppercase tracking-widest mb-1">Travel Request Authorization</h1>
        <p className="text-sm text-slate-500">CDG Group - Internal Document</p>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <div className="text-xs uppercase font-bold text-slate-400">Request ID</div>
          <div className="text-lg font-mono font-bold">{request.id}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase font-bold text-slate-400">Date</div>
          <div className="text-lg">{formatDate(request.submittedAt)}</div>
        </div>
      </div>

      <div className="mb-8 p-4 bg-slate-50 border border-slate-200">
        <h3 className="font-bold border-b border-slate-200 pb-2 mb-2">Traveler Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-bold">Name:</span> {request.requesterName}</div>
          <div><span className="font-bold">Employee ID:</span> {request.requesterId}</div>
          <div><span className="font-bold">Department:</span> {request.travelers[0]?.department || 'N/A'}</div>
          <div><span className="font-bold">Cost Center:</span> {request.trip.costCenter || 'N/A'}</div>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="font-bold border-b border-slate-200 pb-2 mb-2">Trip Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><span className="font-bold">Destination:</span> {request.trip.destination}</div>
          <div><span className="font-bold">Dates:</span> {formatDate(request.trip.startDate)} to {formatDate(request.trip.endDate)}</div>
          <div className="col-span-2"><span className="font-bold">Purpose:</span> {request.trip.purpose}</div>
        </div>

        <table className="w-full text-sm border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-100">
              <th className="border p-2 text-left">Service</th>
              <th className="border p-2 text-left">Details</th>
              <th className="border p-2 text-right">Cost (THB)</th>
            </tr>
          </thead>
          <tbody>
            {request.services.map(s => (
              <tr key={s.id}>
                <td className="border p-2">{s.type}</td>
                <td className="border p-2">{(s as any).flightNumber || (s as any).hotelName || 'N/A'}</td>
                <td className="border p-2 text-right">{formatCurrency(s.actualCost || 0)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-slate-50">
              <td className="border p-2 text-right" colSpan={2}>TOTAL</td>
              <td className="border p-2 text-right">{formatCurrency(request.actualCost || request.estimatedCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ... PrintSummaryReport omitted for brevity, logic is similar ...

interface DashboardProps {
  onRequestNew: () => void;
  onTalkToAI: () => void;
  requests: TravelRequest[];
  onEdit: (req: TravelRequest) => void;
  onDelete: (id: string) => void;
  role?: UserRole;
  onProcessRequest?: (req: TravelRequest) => void; 
  onViewAllRequests: () => void;
  onReview?: (req: TravelRequest) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    onRequestNew, requests, onEdit, onDelete, role = 'Employee', onProcessRequest, onViewAllRequests, onReview
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'ALL' | 'INBOX'>('INBOX');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [printRequest, setPrintRequest] = useState<TravelRequest | null>(null);

  // --- Memoized Data Logic (Performance) ---
  const { myRequests, recentRequests, pendingApprovals, adsInbox, adsDisplayData, stats, waitingSelection } = useMemo(() => {
    const isEmployee = role === 'Employee';
    const myReqs = requests.filter(r => r.requesterId === 'EMP001' || !isEmployee); 
    
    const recent = [...myReqs]
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 5);

    const pending = requests.filter(r => r.status === RequestStatus.PENDING_APPROVAL);
    const waiting = requests.filter(r => r.status === RequestStatus.WAITING_EMPLOYEE_SELECTION);
    const inbox = requests.filter(r => r.status === RequestStatus.SUBMITTED || r.status === RequestStatus.QUOTATION_PENDING);
    const display = activeTab === 'ALL' ? requests : inbox;

    const processedCount = requests.filter(r => 
        r.status === RequestStatus.APPROVED || 
        r.status === RequestStatus.REJECTED || 
        r.status === RequestStatus.BOOKED || 
        r.status === RequestStatus.COMPLETED
    ).length;

    const policyFlagCount = requests.filter(r => r.policyFlags && r.policyFlags.length > 0).length;
    const activeTripCount = requests.filter(r => r.status !== 'Completed' && r.status !== 'Rejected').length;
    const totalSpend = requests.reduce((sum, r) => sum + (Number(r.actualCost || r.estimatedCost) || 0), 0);

    return { 
        myRequests: myReqs, 
        recentRequests: recent, 
        pendingApprovals: pending, 
        waitingSelection: waiting,
        adsInbox: inbox, 
        adsDisplayData: display,
        stats: {
            processed: processedCount,
            flags: policyFlagCount,
            activeTrips: activeTripCount,
            spend: totalSpend
        }
    };
  }, [requests, role, activeTab]);

  const handlePrint = (req?: TravelRequest) => {
      setPrintRequest(req || null);
      setIsExportMenuOpen(false);
      setTimeout(() => window.print(), 300);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24 print:p-0 print:max-w-none print:bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('dash.title')}</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
              {t('role')}: <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${role === 'ADS' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>{role}</span> 
              • {t('dash.costCenter')}: CC-GEN-001
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onRequestNew}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
            aria-label="Create New Request"
          >
            <Plus size={20} />
            {t('dash.btn.create')}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden">
        {role === 'ADS' ? (
             <>
                <StatCard label={t('dash.stat.newReq')} value={adsInbox.length.toString()} icon={Inbox} color="blue" />
                <StatCard label={t('dash.stat.pendingQuote')} value={requests.filter(r => r.status === RequestStatus.QUOTATION_PENDING).length.toString()} icon={Mail} color="orange" />
                <StatCard label={t('dash.stat.processed')} value={stats.processed.toString()} icon={CheckCircle} color="green" trend="Calculated" trendUp={true}/>
                <StatCard label={t('dash.stat.policyFlag')} value={stats.flags.toString()} icon={AlertTriangle} color="purple" />
             </>
        ) : (
             <>
                <StatCard label={t('dash.stat.activeTrips')} value={stats.activeTrips.toString()} icon={Plane} color="blue" />
                {waitingSelection.length > 0 ? (
                    <StatCard label="Action Required" value={waitingSelection.length.toString() + " Pending Selection"} icon={MousePointerClick} color="red" trend="Urgent" />
                ) : (
                    <StatCard label={t('dash.stat.approvalsWaiting')} value={pendingApprovals.length.toString()} icon={ShieldCheck} color="orange" />
                )}
                <StatCard label={t('dash.stat.totalSpend')} value={formatCurrency(stats.spend)} icon={FileText} color="purple" />
                <StatCard label={t('dash.stat.slaCompliance')} value="98.5%" icon={CheckCircle} color="green" trend="+2.4%" trendUp={true} />
             </>
        )}
      </div>

      {/* ADS Workbench */}
      {role === 'ADS' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px] print:border-none print:shadow-none print:rounded-none print:overflow-visible">
              
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center print:hidden">
                  <div className="flex gap-4">
                    {(['INBOX', 'ALL'] as const).map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {tab === 'INBOX' ? `${t('dash.ads.tab.inbox')} (${adsInbox.length})` : t('dash.ads.tab.all')}
                        </button>
                    ))}
                  </div>

                  {/* Export Controls */}
                  <div className="relative">
                      <button 
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                      >
                          <Download size={16}/> {t('dash.ads.export')} <ChevronDown size={14}/>
                      </button>
                      
                      {isExportMenuOpen && (
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                              <button onClick={() => { exportService.toCSV(adsDisplayData); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                                  <FileText size={16} className="text-green-600"/> Export CSV
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button onClick={() => handlePrint()} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-900 font-bold">
                                  <Printer size={16}/> Print Full Report
                              </button>
                          </div>
                      )}
                  </div>
              </div>

              {/* List View */}
              <div className="p-0 print:hidden">
                  {adsDisplayData.map((req) => {
                      const sla = getSLAStatus(req.slaDeadline, req.status);
                      return (
                        <div key={req.id} className="p-5 border-b border-slate-50 hover:bg-blue-50/30 transition-colors flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${req.status === RequestStatus.SUBMITTED ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {req.status === RequestStatus.SUBMITTED ? <Inbox size={20}/> : <Mail size={20}/>}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{req.trip.destination} <span className="text-slate-400 font-normal">#{req.id}</span></h3>
                                    <p className="text-sm text-slate-500">{req.requesterName} • {formatDate(req.trip.startDate)} • Est: {formatCurrency(req.estimatedCost)}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {sla && (
                                    <div className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${sla.colorClass}`}>
                                        <Clock size={12} className={sla.iconColor}/>
                                        {sla.label}
                                    </div>
                                )}

                                <StatusBadge status={req.status} />

                                {(req.status === RequestStatus.SUBMITTED || req.status === RequestStatus.QUOTATION_PENDING) && (
                                    <button 
                                      onClick={() => onProcessRequest?.(req)}
                                      className="px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg shadow-md hover:bg-slate-800 transition-transform active:scale-95 flex items-center gap-2"
                                    >
                                        Process <span className="hidden sm:inline">Request</span>
                                    </button>
                                )}
                            </div>
                        </div>
                      );
                  })}
              </div>

              {/* Print View Logic */}
              <div className="hidden print:block p-8">
                  {printRequest && <PrintSingleTicket request={printRequest} />}
              </div>
          </div>
      )}

      {/* Employee List (Recent) */}
      {role !== 'ADS' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden print:hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">{t('dash.list.recent')}</h2>
                <button 
                    onClick={onViewAllRequests}
                    className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                >
                    {t('dash.list.viewAll')} <ArrowRight size={16}/>
                </button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.id')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.detail')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.type')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.status')}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.cost')}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.actions')}</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {recentRequests.map((req) => (
                    <tr 
                        key={req.id} 
                        onClick={() => onEdit(req)}
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer relative"
                    >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        <span className="font-mono text-slate-500 group-hover:text-blue-600">{formatRequestId(req.id)}</span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${getTravelTypeStyle(req.travelType)}`}>
                            <Plane size={16} />
                        </div>
                        <div>
                            <span className="text-sm font-medium text-slate-900 block">{req.trip.destination}</span>
                            <span className="text-xs text-slate-400">{formatDate(req.trip.startDate)}</span>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${req.requestFor !== RequestFor.SELF ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                            <Users size={12} className="mr-1"/>
                            {t(`common.${req.requestFor.toLowerCase()}`)}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <StatusBadge status={req.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                        {req.actualCost ? (
                            <div className="flex flex-col">
                                <span className="font-bold text-green-700">{formatCurrency(req.actualCost)}</span>
                                <span className="text-[10px] text-slate-400 line-through">est: {formatCurrency(req.estimatedCost)}</span>
                            </div>
                        ) : (
                            <span>{formatCurrency(req.estimatedCost)}</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right relative z-30">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {role === 'Manager' && req.status === RequestStatus.PENDING_APPROVAL && (
                             <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onReview?.(req); }}
                                className="p-2 bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors shadow-sm relative z-30"
                                title="Review Request"
                            >
                                <FileSearch size={16} />
                            </button>
                        )}
                        {req.status === RequestStatus.WAITING_EMPLOYEE_SELECTION && (
                             <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEdit(req); }}
                                className="px-3 py-1 bg-pink-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-pink-700 transition-colors flex items-center gap-1 relative z-30"
                             >
                                 Select <span className="hidden sm:inline">Option</span>
                             </button>
                        )}
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(req); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors relative z-30"
                        >
                            <Pencil size={16} />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(req.id); }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors relative z-30"
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        </div>
      )}
    </div>
  );
};
