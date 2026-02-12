
import React, { useState, useMemo } from 'react';
import { 
    Plus, Plane, FileText, CheckCircle, Clock, Inbox, Mail, 
    AlertTriangle, ArrowRight, ShieldCheck, Download, Printer, 
    FileSpreadsheet, FileJson, ChevronDown, Users, Pencil, Trash2, FileSearch
} from 'lucide-react';
import { StatCard } from './StatCard';
import { TravelRequest, RequestStatus, RequestFor, UserRole } from '../types';
import { getSLAStatus } from '../services/slaService';
import { exportService } from '../services/exportService';
import { useTranslation } from '../services/translations';

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
  const { myRequests, recentRequests, pendingApprovals, adsInbox, adsDisplayData, stats } = useMemo(() => {
    const isEmployee = role === 'Employee';
    // Filter: My Requests
    const myReqs = requests.filter(r => r.requesterId === 'EMP001' || !isEmployee); 
    
    // Filter: Recent (Top 5)
    const recent = [...myReqs]
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 5);

    // Filter: Pending Approvals
    const pending = requests.filter(r => r.status === RequestStatus.PENDING_APPROVAL);

    // Filter: ADS Inbox
    const inbox = requests.filter(r => r.status === RequestStatus.SUBMITTED || r.status === RequestStatus.QUOTATION_PENDING);
    
    // Display Data based on Tab
    const display = activeTab === 'ALL' ? requests : inbox;

    // --- Calculated Stats ---
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

  // --- Handlers ---

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
                <StatCard label={t('dash.stat.approvalsWaiting')} value={pendingApprovals.length.toString()} icon={ShieldCheck} color="orange" />
                <StatCard label={t('dash.stat.totalSpend')} value={`฿ ${stats.spend.toLocaleString()}`} icon={FileText} color="purple" />
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
                        aria-haspopup="true"
                        aria-expanded={isExportMenuOpen}
                      >
                          <Download size={16}/> {t('dash.ads.export')} <ChevronDown size={14}/>
                      </button>
                      
                      {isExportMenuOpen && (
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                              <button onClick={() => { exportService.toCSV(adsDisplayData); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                                  <FileText size={16} className="text-green-600"/> Export CSV
                              </button>
                              <button onClick={() => { exportService.toExcelXML(adsDisplayData); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                                  <FileSpreadsheet size={16} className="text-green-600"/> Export Excel
                              </button>
                              <button onClick={() => { exportService.toJSON(adsDisplayData); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700">
                                  <FileJson size={16} className="text-orange-600"/> Export JSON
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
                  {activeTab === 'INBOX' && adsInbox.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                          <CheckCircle size={48} className="mb-4 text-green-200"/>
                          <p>{t('dash.ads.caughtUp')}</p>
                      </div>
                  )}
                  
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
                                    <p className="text-sm text-slate-500">{req.requesterName} • {req.trip.startDate} • Est: ฿{req.estimatedCost.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                {sla && (
                                    <div className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${sla.colorClass}`}>
                                        <Clock size={12} className={sla.iconColor}/>
                                        {sla.label}
                                    </div>
                                )}

                                <span className={`px-3 py-1 rounded-full text-xs font-bold border 
                                    ${req.status === RequestStatus.SUBMITTED ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                      req.status === RequestStatus.QUOTATION_PENDING ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                      'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                    {t(`status.${req.status}`)}
                                </span>

                                <button 
                                    onClick={() => handlePrint(req)}
                                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Print Ticket"
                                    aria-label="Print Ticket"
                                >
                                    <Printer size={18} />
                                </button>

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
                  {printRequest ? (
                    <PrintSingleTicket request={printRequest} />
                  ) : (
                    <PrintSummaryReport requests={adsDisplayData} filter={activeTab} />
                  )}
              </div>
          </div>
      )}

      {/* Employee List */}
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
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        <span className="font-mono text-slate-500 group-hover:text-blue-600">#{req.id.slice(-6)}</span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${req.travelType === 'INTERNATIONAL' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            <Plane size={16} />
                        </div>
                        <div>
                            <span className="text-sm font-medium text-slate-900 block">{req.trip.destination}</span>
                            <span className="text-xs text-slate-400">{req.trip.startDate}</span>
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${req.status === RequestStatus.APPROVED ? 'bg-green-100 text-green-800' : 
                            req.status === RequestStatus.PENDING_APPROVAL ? 'bg-orange-100 text-orange-800' : 
                            req.status === RequestStatus.SUBMITTED ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'}`}>
                        {t(`status.${req.status}`)}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                        {req.actualCost ? (
                            <div className="flex flex-col">
                                <span className="font-bold text-green-700">฿ {req.actualCost.toLocaleString()}</span>
                                <span className="text-[10px] text-slate-400 line-through">est: {req.estimatedCost.toLocaleString()}</span>
                            </div>
                        ) : (
                            <span>฿ {Number(req.estimatedCost).toLocaleString()}</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right relative z-20">
                        <div className="flex items-center justify-end gap-2">
                        {role === 'Manager' && req.status === RequestStatus.PENDING_APPROVAL && (
                             <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onReview?.(req); }}
                                className="p-2 bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors shadow-sm"
                                title="Review Request"
                            >
                                <FileSearch size={16} />
                            </button>
                        )}
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(req); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <Pencil size={16} />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(req.id); }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

// --- Sub-components for Printing (Clean Code: Separation) ---

const PrintSingleTicket: React.FC<{ request: TravelRequest }> = ({ request }) => (
    <div>
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
                <div>
                <h1 className="text-3xl font-bold text-slate-900">Travel Request Document</h1>
                <p className="text-slate-500 mt-1">Official Booking Request Form</p>
                </div>
                <div className="text-right">
                    <div className="text-xl font-mono font-bold text-slate-700">{request.id}</div>
                    <div className="text-sm text-slate-400">{new Date().toLocaleDateString()}</div>
                </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-200 pb-1 mb-2">Requester Info</h3>
                <div className="space-y-1 text-sm">
                    <div className="grid grid-cols-3"><span className="text-slate-500">Name:</span> <span className="col-span-2 font-semibold">{request.requesterName}</span></div>
                    <div className="grid grid-cols-3"><span className="text-slate-500">Employee ID:</span> <span className="col-span-2">{request.requesterId}</span></div>
                    <div className="grid grid-cols-3"><span className="text-slate-500">For:</span> <span className="col-span-2">{request.requestFor}</span></div>
                </div>
            </div>
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-200 pb-1 mb-2">Trip Details</h3>
                <div className="space-y-1 text-sm">
                    <div className="grid grid-cols-3"><span className="text-slate-500">Destination:</span> <span className="col-span-2 font-semibold">{request.trip.destination}</span></div>
                    <div className="grid grid-cols-3"><span className="text-slate-500">Dates:</span> <span className="col-span-2">{request.trip.startDate} - {request.trip.endDate}</span></div>
                    <div className="grid grid-cols-3"><span className="text-slate-500">Project:</span> <span className="col-span-2">{request.trip.projectCode}</span></div>
                </div>
            </div>
        </div>

        <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-200 pb-1 mb-4">Service Details & Costs</h3>
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-slate-100">
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Description</th>
                        <th className="p-2 text-left">Ref</th>
                        <th className="p-2 text-right">Cost (THB)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {request.services.map((svc) => (
                        <tr key={svc.id}>
                            <td className="p-2 font-bold">{svc.type}</td>
                            <td className="p-2">
                                {svc.type === 'FLIGHT' && `${svc.from} - ${svc.to} (${svc.flightNumber || 'TBD'})`}
                                {svc.type === 'HOTEL' && `${svc.hotelName || svc.location} (${svc.roomType})`}
                                {svc.type === 'CAR' && `${svc.carType} @ ${svc.pickupLocation}`}
                                {svc.type === 'INSURANCE' && 'Travel Insurance'}
                            </td>
                            <td className="p-2 font-mono">{svc.bookingReference || '-'}</td>
                            <td className="p-2 text-right">{svc.actualCost?.toLocaleString() || '-'}</td>
                        </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300">
                        <td colSpan={3} className="p-2 text-right font-bold">Total Actual Cost:</td>
                        <td className="p-2 text-right font-bold text-lg">{request.actualCost?.toLocaleString() || '-'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
);

const PrintSummaryReport: React.FC<{ requests: TravelRequest[]; filter: string }> = ({ requests, filter }) => (
    <div>
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Travel Requests Report</h1>
                <p className="text-slate-500 text-sm mt-1">Generated: {new Date().toLocaleString()}</p>
            </div>
            <div className="text-right">
                <div className="text-sm font-bold text-slate-700">Filter: {filter}</div>
                <div className="text-xs text-slate-400">Total Records: {requests.length}</div>
            </div>
        </div>

        <table className="w-full text-sm">
            <thead>
                <tr className="border-b-2 border-slate-200">
                    <th className="py-2 text-left font-bold text-slate-700">ID</th>
                    <th className="py-2 text-left font-bold text-slate-700">Requester</th>
                    <th className="py-2 text-left font-bold text-slate-700">Destination</th>
                    <th className="py-2 text-left font-bold text-slate-700">Dates</th>
                    <th className="py-2 text-left font-bold text-slate-700">Status</th>
                    <th className="py-2 text-right font-bold text-slate-700">Est. Cost</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                    <tr key={req.id}>
                        <td className="py-2 font-mono text-xs">{req.id}</td>
                        <td className="py-2">{req.requesterName}</td>
                        <td className="py-2 font-semibold">{req.trip.destination}</td>
                        <td className="py-2 text-xs">{req.trip.startDate} - {req.trip.endDate}</td>
                        <td className="py-2">
                            <span className="border border-slate-200 px-1 rounded text-xs">{req.status}</span>
                        </td>
                        <td className="py-2 text-right font-mono">{(req.actualCost || req.estimatedCost).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
