
import React, { useState, useMemo } from 'react';
import { 
    Plus, Plane, FileText, CheckCircle, Clock, Inbox, Mail, 
    AlertTriangle, ArrowRight, ShieldCheck, Download, Printer, 
    ChevronDown, Users, Pencil, Trash2, FileSearch, MousePointerClick,
    Briefcase, Wallet, Ban, Server, Activity
} from 'lucide-react';
import { StatCard } from './StatCard';
import { TravelRequest, RequestStatus, RequestFor, UserRole } from '../types';
import { getSLAStatus } from '../services/slaService';
import { exportService } from '../services/exportService';
import { useTranslation } from '../services/translations';
import { StatusBadge } from './common/StatusBadge'; 
import { formatCurrency, formatDate, formatRequestId } from '../utils/formatters'; 
import { getTravelTypeStyle } from '../utils/styleHelpers'; 
import { storageService } from '../services/storage';

// --- Print Components ---
const PrintSingleTicket: React.FC<{ request: TravelRequest }> = ({ request }) => {
  const settings = storageService.getSettings();
  return (
    <div className="p-8 border border-slate-300 max-w-3xl mx-auto font-serif bg-white text-black">
      <div className="text-center mb-8 border-b pb-4">
        {settings.docTemplates.showLogo && <div className="text-2xl font-bold mb-2 text-slate-900">{settings.branding.appName.charAt(0)}</div>}
        <h1 className="text-2xl font-bold uppercase tracking-widest mb-1">{settings.docTemplates.headerText}</h1>
        <p className="text-sm text-slate-500">Official Travel Authorization</p>
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
      {/* ... Rest of Print Ticket (Same as before) ... */}
      <div className="mt-8 pt-4 border-t text-center text-xs text-slate-400">
          {settings.docTemplates.footerText}
      </div>
    </div>
  );
};

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
  
  // Load settings for Dashboard Config
  const settings = storageService.getSettings();
  const { dashboardConfig } = settings;

  // --- Memoized Data Logic (Performance) ---
  const { 
    myRequests, 
    recentRequests, 
    pendingApprovals, 
    adsInbox, 
    adsDisplayData, 
    waitingSelection,
    stats 
  } = useMemo(() => {
    // 1. Role-based filtering
    const isEmployee = role === 'Employee';
    const isManager = role === 'Manager';
    const isPresident = role === 'President';
    const isApprover = isManager || isPresident;
    const isIT = role === 'IT_ADMIN';

    // My Requests (For Employee View)
    const myReqs = requests.filter(r => r.requesterId === 'EMP001' || (!isEmployee && !isApprover && !isIT)); 

    // Recent Requests (For Table)
    const recent = [...requests]
        .filter(r => isEmployee ? r.requesterId === 'EMP001' : true) // Employees see only theirs
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
        .slice(0, 5);

    // Approver: Pending Approvals
    // President sees all pending high-value items, Manager sees their team
    const pending = requests.filter(r => {
        if (r.status !== RequestStatus.PENDING_APPROVAL) return false;
        if (isPresident) return (r.estimatedCost || 0) > 50000; // Only see high value? Or all? Let's say all for now.
        return true;
    });
    
    // Employee: Waiting Selection
    const waiting = requests.filter(r => r.status === RequestStatus.WAITING_EMPLOYEE_SELECTION && (isEmployee ? r.requesterId === 'EMP001' : true));
    
    // ADS: Inbox
    const inbox = requests.filter(r => r.status === RequestStatus.SUBMITTED || r.status === RequestStatus.QUOTATION_PENDING);
    const display = activeTab === 'ALL' ? requests : inbox;

    // --- Stats Calculation ---
    const processedCount = requests.filter(r => 
        r.status === RequestStatus.APPROVED || 
        r.status === RequestStatus.REJECTED || 
        r.status === RequestStatus.BOOKED || 
        r.status === RequestStatus.COMPLETED
    ).length;

    const policyFlagCount = requests.filter(r => r.policyFlags && r.policyFlags.length > 0).length;
    
    // Active Trips: Not Draft, Not Completed, Not Rejected
    const activeTripCount = requests.filter(r => r.status !== RequestStatus.DRAFT && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.REJECTED).length;
    
    // Spend: Use Actual if available, else Est
    const totalSpend = requests.reduce((sum, r) => sum + (Number(r.actualCost || r.estimatedCost) || 0), 0);

    // --- REAL SLA CALCULATION ---
    const activeRequestsForSLA = requests.filter(r => 
        r.status !== RequestStatus.DRAFT && 
        r.status !== RequestStatus.COMPLETED && 
        r.status !== RequestStatus.REJECTED &&
        r.status !== RequestStatus.BOOKED
    );
    
    const totalActiveForSLA = activeRequestsForSLA.length;
    let slaCompliance: number | null = null;

    if (totalActiveForSLA > 0) {
        const breachedCount = activeRequestsForSLA.filter(r => {
            const sla = getSLAStatus(r.slaDeadline, r.status);
            return sla?.expired;
        }).length;
        slaCompliance = ((totalActiveForSLA - breachedCount) / totalActiveForSLA) * 100;
    }

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
            spend: totalSpend,
            slaCompliance: slaCompliance // Can be null
        }
    };
  }, [requests, role, activeTab]);

  const handlePrint = (req?: TravelRequest) => {
      setPrintRequest(req || null);
      setIsExportMenuOpen(false);
      setTimeout(() => window.print(), 300);
  };

  const isApprover = role === 'Manager' || role === 'President';
  const isIT = role === 'IT_ADMIN';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24 print:p-0 print:max-w-none print:bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('dash.title')}</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
              {t('role')}: <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase 
                ${role === 'ADS' ? 'bg-purple-100 text-purple-700' : 
                  isIT ? 'bg-red-100 text-red-700' :
                  isApprover ? 'bg-orange-100 text-orange-700' : 
                  'bg-blue-100 text-blue-700'}`}>
                    {role.replace('_', ' ')}
              </span> 
              • {t('dash.costCenter')}: CC-GEN-001
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onRequestNew}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl active:scale-95 bg-primary hover:opacity-90"
            aria-label="Create New Request"
          >
            <Plus size={20} />
            {t('dash.btn.create')}
          </button>
        </div>
      </div>

      {/* --- STATS GRID (Dynamic based on Settings) --- */}
      {dashboardConfig.showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden">
            {role === 'ADS' && (
                <>
                    <StatCard label={t('dash.stat.newReq')} value={adsInbox.length.toString()} icon={Inbox} color="blue" />
                    <StatCard label={t('dash.stat.pendingQuote')} value={requests.filter(r => r.status === RequestStatus.QUOTATION_PENDING).length.toString()} icon={Mail} color="orange" />
                    <StatCard label={t('dash.stat.processed')} value={stats.processed.toString()} icon={CheckCircle} color="green" />
                    <StatCard label={t('dash.stat.slaCompliance')} value={stats.slaCompliance !== null ? `${stats.slaCompliance.toFixed(1)}%` : "N/A"} icon={Clock} color="purple" />
                </>
            )}
            
            {role === 'Employee' && (
                <>
                    <StatCard label={t('dash.stat.activeTrips')} value={stats.activeTrips.toString()} icon={Plane} color="blue" />
                    {waitingSelection.length > 0 ? (
                        <StatCard label="Action Required" value={waitingSelection.length.toString() + " Pending Selection"} icon={MousePointerClick} color="red" trend="Urgent" />
                    ) : (
                        <StatCard label={t('dash.stat.approvalsWaiting')} value={myRequests.filter(r => r.status === RequestStatus.PENDING_APPROVAL).length.toString()} icon={Clock} color="orange" />
                    )}
                    <StatCard label={t('dash.stat.totalSpend')} value={formatCurrency(stats.spend)} icon={FileText} color="purple" />
                    <StatCard label="Drafts" value={myRequests.filter(r => r.status === RequestStatus.DRAFT).length.toString()} icon={Pencil} color="green" />
                </>
            )}

            {isApprover && (
                <>
                    <StatCard label={t('dash.stat.approvalsWaiting')} value={pendingApprovals.length.toString()} icon={ShieldCheck} color="orange"/>
                    <StatCard label="Department Active Trips" value={stats.activeTrips.toString()} icon={Briefcase} color="blue" />
                    <StatCard label="Department Spend (YTD)" value={formatCurrency(stats.spend)} icon={Wallet} color="purple" />
                    <StatCard label="Rejected Requests" value={requests.filter(r => r.status === RequestStatus.REJECTED).length.toString()} icon={Ban} color="red" />
                </>
            )}

            {isIT && (
                <>
                     <StatCard label="System Health" value="99.9%" icon={Activity} color="green" />
                     <StatCard label="Total Requests (DB)" value={requests.length.toString()} icon={Server} color="blue" />
                     <StatCard label="Active Users" value="12" icon={Users} color="purple" />
                     <StatCard label="Failed API Calls" value="0" icon={AlertTriangle} color="red" />
                </>
            )}
          </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}

      {/* ADS Workbench */}
      {role === 'ADS' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
              {/* Toolbar */}
              <div className="p-4 border-b border-slate-100 flex justify-between items-center print:hidden">
                  <div className="flex gap-4">
                    {(['INBOX', 'ALL'] as const).map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === tab ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            {tab === 'INBOX' ? `${t('dash.ads.tab.inbox')} (${adsInbox.length})` : t('dash.ads.tab.all')}
                        </button>
                    ))}
                  </div>
                  {/* Export... */}
                  <div className="relative">
                      <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold"><Download size={16}/> {t('dash.ads.export')}</button>
                       {isExportMenuOpen && (
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                              <button onClick={() => { exportService.toCSV(adsDisplayData); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700"><FileText size={16}/> CSV</button>
                              <button onClick={() => handlePrint()} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-900 font-bold"><Printer size={16}/> Print</button>
                          </div>
                      )}
                  </div>
              </div>
              
              {/* List */}
              <div className="p-0">
                  {adsDisplayData.length === 0 && <div className="p-16 text-center text-slate-400">Caught Up</div>}
                  {adsDisplayData.map(req => (
                      <div key={req.id} className="p-5 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-full ${req.status === RequestStatus.SUBMITTED ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                {req.status === RequestStatus.SUBMITTED ? <Inbox size={20}/> : <Mail size={20}/>}
                              </div>
                              <div>
                                  <h3 className="font-bold text-slate-800">{req.trip.destination} <span className="text-slate-400 font-normal">#{req.id}</span></h3>
                                  <p className="text-sm text-slate-500">{req.requesterName} • {formatDate(req.trip.startDate)}</p>
                              </div>
                          </div>
                          <div className="flex gap-3 items-center">
                              <StatusBadge status={req.status}/>
                              <button onClick={() => onProcessRequest?.(req)} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:opacity-90">Process</button>
                          </div>
                      </div>
                  ))}
              </div>
               {/* Print View Logic */}
              <div className="hidden print:block p-8">
                  {printRequest && <PrintSingleTicket request={printRequest} />}
              </div>
          </div>
      )}

      {/* Employee & Approver Table View (Conditional) */}
      {role !== 'ADS' && dashboardConfig.showRecentRequests && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden print:hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">
                    {isApprover && pendingApprovals.length > 0 ? 'Approvals Required' : isIT ? 'System Requests Log' : t('dash.list.recent')}
                </h2>
                <button 
                    onClick={onViewAllRequests}
                    className="text-sm font-bold text-primary hover:opacity-80 flex items-center gap-1 transition-colors"
                >
                    {t('dash.list.viewAll')} <ArrowRight size={16}/>
                </button>
            </div>
            {/* Table Code (Same as previous, utilizing dynamic recentRequests) */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.id')}</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.detail')}</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.status')}</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.cost')}</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('dash.table.actions')}</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {(isApprover && pendingApprovals.length > 0 ? pendingApprovals : recentRequests).map((req) => (
                        <tr key={req.id} onClick={() => onEdit(req)} className="hover:bg-slate-50/50 transition-colors cursor-pointer">
                            <td className="px-6 py-4 font-mono text-sm">{formatRequestId(req.id)}</td>
                            <td className="px-6 py-4">
                                <span className="font-bold text-slate-800 block">{req.trip.destination}</span>
                                <span className="text-xs text-slate-500">{formatDate(req.trip.startDate)}</span>
                            </td>
                            <td className="px-6 py-4"><StatusBadge status={req.status}/></td>
                            <td className="px-6 py-4 text-right font-bold text-slate-700">{formatCurrency(req.actualCost || req.estimatedCost)}</td>
                            <td className="px-6 py-4 text-right">
                                {isApprover && req.status === RequestStatus.PENDING_APPROVAL ? (
                                    <button onClick={(e) => {e.stopPropagation(); onReview?.(req)}} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold shadow-md hover:bg-green-700 transition-colors">Review</button>
                                ) : (
                                    <button onClick={(e) => {e.stopPropagation(); onEdit(req)}} className="text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={16}/></button>
                                )}
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
