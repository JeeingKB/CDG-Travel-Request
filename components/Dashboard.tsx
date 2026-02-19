
import React, { useState, useMemo, useRef } from 'react';
import { 
    Plus, Plane, FileText, CheckCircle, Clock, Inbox, Mail, 
    AlertTriangle, ArrowRight, ShieldCheck, Download, Printer, 
    ChevronDown, Users, Pencil, Trash2, FileSearch, MousePointerClick,
    Briefcase, Wallet, Ban, Server, Activity, BarChart3, BookmarkCheck, BellRing, User, UploadCloud, FileSpreadsheet
} from 'lucide-react';
import { StatCard } from './StatCard';
import { TravelRequest, RequestStatus, RequestFor, UserRole, TravelerDetails } from '../types';
import { getSLAStatus } from '../services/slaService';
import { exportService } from '../services/exportService';
import { useTranslation } from '../services/translations';
import { StatusBadge } from './common/StatusBadge'; 
import { formatCurrency, formatDate, formatRequestId } from '../utils/formatters'; 
import { getTravelTypeStyle } from '../utils/styleHelpers'; 
import { storageService } from '../services/storage';
import { ServiceIcon } from './common/ServiceIcon'; 
import { useAuth } from '../contexts/AuthContext'; 

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
      
      <div className="mb-8">
          <h3 className="font-bold border-b border-slate-200 pb-2 mb-2">Trip Details</h3>
          <table className="w-full text-sm">
              <tbody>
                  <tr>
                      <td className="py-1 font-bold w-32">Destination:</td>
                      <td>{request.trip.destination}</td>
                  </tr>
                  <tr>
                      <td className="py-1 font-bold">Duration:</td>
                      <td>{formatDate(request.trip.startDate)} - {formatDate(request.trip.endDate)}</td>
                  </tr>
                  <tr>
                      <td className="py-1 font-bold">Purpose:</td>
                      <td>{request.trip.purpose}</td>
                  </tr>
              </tbody>
          </table>
      </div>

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
  onBookRequest?: (req: TravelRequest) => void; 
  onViewAllRequests: () => void;
  onReview?: (req: TravelRequest) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
    onRequestNew, requests, onEdit, onDelete, role = 'Employee', onProcessRequest, onBookRequest, onViewAllRequests, onReview
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Set default tab based on Role
  const [activeTab, setActiveTab] = useState<'MY_REQUESTS' | 'TEAM_INBOX' | 'ALL'>('MY_REQUESTS');
  
  // Initialize tab once when role changes
  React.useEffect(() => {
      if (role === 'ADS') setActiveTab('TEAM_INBOX');
      else if (role === 'Manager') setActiveTab('TEAM_INBOX'); // "Approvals"
      else setActiveTab('MY_REQUESTS');
  }, [role]);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [printRequest, setPrintRequest] = useState<TravelRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Load settings
  const settings = storageService.getSettings();
  const { dashboardConfig } = settings;

  // --- Filter Logic ---
  const { 
    myRequests, 
    teamInboxRequests, 
    stats,
    dailyVolumes 
  } = useMemo(() => {
    // 1. My Requests (Always strictly my own)
    const myReqs = requests.filter(r => r.requesterId === user?.id)
        .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());

    // 2. Team Inbox (Work items for ADS/Manager)
    let teamReqs: TravelRequest[] = [];
    
    if (role === 'ADS') {
        // ADS sees: Submitted (needs quote), Quotation Pending (needs follow up), Approved (needs booking)
        teamReqs = requests.filter(r => 
            r.status === RequestStatus.SUBMITTED || 
            r.status === RequestStatus.QUOTATION_PENDING ||
            r.status === RequestStatus.APPROVED 
        ).sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
    } else if (role === 'Manager' || role === 'President') {
        // Approver sees: Pending Approval assigned to them
        teamReqs = requests.filter(r => {
            if (r.status !== RequestStatus.PENDING_APPROVAL) return false;
            // Check if current role matches
            // In real app, check 'currentApproverRole' vs userRole map
            const waitingRole = r.currentApproverRole;
            if (role === 'Manager' && (waitingRole === 'Line Manager' || waitingRole === 'Department Head')) return true;
            if (role === 'President' && (waitingRole === 'CFO' || waitingRole === 'President' || waitingRole === 'GM')) return true;
            return false;
        }).sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
    } else if (role === 'IT_ADMIN') {
        teamReqs = requests; // Sees all
    }

    // --- Stats ---
    const processedCount = requests.filter(r => 
        r.status === RequestStatus.BOOKED || 
        r.status === RequestStatus.COMPLETED ||
        r.status === RequestStatus.REJECTED
    ).length;

    const policyFlagCount = requests.filter(r => r.policyFlags && r.policyFlags.length > 0).length;
    const activeTripCount = requests.filter(r => r.status !== RequestStatus.DRAFT && r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.REJECTED).length;
    const totalSpend = requests.reduce((sum, r) => sum + (Number(r.actualCost || r.estimatedCost) || 0), 0);

    // SLA
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

    // Daily Volumes (ADS only)
    const dailyVolumes: Record<string, number> = {};
    if (role === 'ADS') {
        const today = new Date();
        for(let i=6; i>=0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyVolumes[key] = 0;
        }
        requests.forEach(r => {
            if (r.submittedAt) {
                const dateKey = r.submittedAt.split('T')[0];
                if (dailyVolumes[dateKey] !== undefined) dailyVolumes[dateKey]++;
                else dailyVolumes[dateKey] = (dailyVolumes[dateKey] || 0) + 1;
            }
        });
    }

    return { 
        myRequests: myReqs, 
        teamInboxRequests: teamReqs,
        dailyVolumes,
        stats: {
            processed: processedCount,
            flags: policyFlagCount,
            activeTrips: activeTripCount,
            spend: totalSpend,
            slaCompliance: slaCompliance
        }
    };
  }, [requests, role, user]);

  const handlePrint = (req?: TravelRequest) => {
      setPrintRequest(req || null);
      setIsExportMenuOpen(false);
      setTimeout(() => window.print(), 300);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const importedPartials = await exportService.parseRequestCSV(file);
              if (importedPartials.length > 0) {
                  // Get master data to fill in names
                  const employees = await storageService.getEmployees();
                  
                  // Convert partials to full requests and save
                  for (const partial of importedPartials) {
                      const newId = await storageService.generateNextRequestId();
                      
                      // Resolve requester name from ID
                      const employee = employees.find(emp => emp.id === partial.requesterId);
                      const requesterName = employee ? employee.name : 'Imported User';
                      
                      const fullRequest: TravelRequest = {
                          ...partial,
                          id: newId,
                          requesterName: requesterName,
                          travelers: employee ? [employee] : [{
                              id: partial.requesterId || 'UNK',
                              name: requesterName,
                              type: 'Employee',
                              title: 'Mr.',
                              department: employee?.department || 'Unknown',
                              jobGrade: employee?.jobGrade || 10,
                              position: employee?.position || 'Staff'
                          } as TravelerDetails],
                          services: partial.services || [],
                          submittedAt: new Date().toISOString()
                      } as TravelRequest;
                      
                      await storageService.saveRequest(fullRequest);
                  }
                  
                  alert(`Successfully imported ${importedPartials.length} requests as Drafts.`);
                  window.location.reload(); // Simple refresh to show new data
              }
          } catch (error) {
              console.error(error);
              alert("Failed to parse CSV. Please check the format.");
          }
      }
      setIsImportMenuOpen(false);
      e.target.value = ''; // Reset input
  };

  // Decide which list to show based on tab
  const displayRequests = activeTab === 'MY_REQUESTS' ? myRequests : 
                          activeTab === 'TEAM_INBOX' ? teamInboxRequests :
                          requests; // ALL

  // Tab Definitions
  const tabs = [
      { id: 'MY_REQUESTS', label: t('my_requests'), count: myRequests.length, icon: User },
      { id: 'TEAM_INBOX', label: role === 'ADS' ? 'Inbox (Action)' : 'Waiting Approval', count: teamInboxRequests.length, icon: Inbox, hidden: role === 'Employee' },
      { id: 'ALL', label: 'All History', count: requests.length, icon: FileSearch, hidden: role === 'Employee' }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24 print:p-0 print:max-w-none print:bg-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t('dash.title')}</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
              {t('role')}: <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase 
                ${role === 'ADS' ? 'bg-purple-100 text-purple-700' : 
                  role === 'IT_ADMIN' ? 'bg-red-100 text-red-700' :
                  (role === 'Manager' || role === 'President') ? 'bg-orange-100 text-orange-700' : 
                  'bg-blue-100 text-blue-700'}`}>
                    {role.replace('_', ' ')}
              </span> 
              • {t('dash.costCenter')}: {user?.id || 'CC-GEN'}
          </p>
        </div>
        <div className="flex gap-3 relative">
          {/* IMPORT BUTTON */}
          <div className="relative">
              <button 
                onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}
                className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl font-medium transition-all shadow-sm hover:bg-slate-50 hover:shadow-md"
              >
                <UploadCloud size={20} />
                Import
              </button>
              {isImportMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                      <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700 font-bold">
                          <FileSpreadsheet size={16}/> Upload CSV
                      </button>
                      <button onClick={() => { exportService.downloadRequestTemplate(); setIsImportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-500">
                          <Download size={16}/> Download Template
                      </button>
                  </div>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleImportFile} />
          </div>

          <button
            onClick={onRequestNew}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl active:scale-95 hover:opacity-90"
          >
            <Plus size={20} />
            {t('dash.btn.create')}
          </button>
        </div>
      </div>

      {/* --- STATS GRID --- */}
      {dashboardConfig.showStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden">
            {role === 'ADS' && (
                <>
                    <StatCard label={t('dash.stat.newReq')} value={teamInboxRequests.filter(r => r.status === RequestStatus.SUBMITTED).length.toString()} icon={Inbox} color="blue" />
                    <StatCard label="Ready to Book" value={teamInboxRequests.filter(r => r.status === RequestStatus.APPROVED).length.toString()} icon={BookmarkCheck} color="green" trend="Action Needed" />
                    <StatCard label={t('dash.stat.processed')} value={stats.processed.toString()} icon={CheckCircle} color="purple" />
                    <StatCard label={t('dash.stat.slaCompliance')} value={stats.slaCompliance !== null ? `${stats.slaCompliance.toFixed(1)}%` : "N/A"} icon={Clock} color="orange" />
                </>
            )}
            
            {role === 'Employee' && (
                <>
                    <StatCard label={t('dash.stat.activeTrips')} value={stats.activeTrips.toString()} icon={Plane} color="blue" />
                    <StatCard label="Drafts" value={myRequests.filter(r => r.status === RequestStatus.DRAFT).length.toString()} icon={Pencil} color="green" />
                    <StatCard label={t('dash.stat.totalSpend')} value={formatCurrency(stats.spend)} icon={FileText} color="purple" />
                    <StatCard label="Completed" value={myRequests.filter(r => r.status === RequestStatus.COMPLETED).length.toString()} icon={CheckCircle} color="orange" />
                </>
            )}

            {(role === 'Manager' || role === 'President') && (
                <>
                    <StatCard label={t('dash.stat.approvalsWaiting')} value={teamInboxRequests.length.toString()} icon={ShieldCheck} color="orange" trend={teamInboxRequests.length > 0 ? 'Action Needed' : ''}/>
                    <StatCard label="Department Active" value={stats.activeTrips.toString()} icon={Briefcase} color="blue" />
                    <StatCard label="Department Spend" value={formatCurrency(stats.spend)} icon={Wallet} color="purple" />
                    <StatCard label="Rejected" value={requests.filter(r => r.status === RequestStatus.REJECTED).length.toString()} icon={Ban} color="red" />
                </>
            )}
          </div>
      )}

      {/* --- ADS DAILY VOLUME WIDGET --- */}
      {role === 'ADS' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 print:hidden">
              <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="text-slate-400" size={20}/>
                  <h3 className="font-bold text-slate-800">📅 Daily Request Volume (Last 7 Days)</h3>
              </div>
              <div className="flex items-end justify-between gap-2 h-32 pt-4">
                  {Object.entries(dailyVolumes).sort().slice(-7).map(([date, count]: [string, any]) => (
                      <div key={date} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="relative w-full flex items-end justify-center h-full bg-slate-50 rounded-lg overflow-hidden group-hover:bg-blue-50 transition-colors">
                              <div 
                                className="w-full bg-blue-500 rounded-t-lg transition-all duration-500 relative min-h-[4px]" 
                                style={{ height: `${Math.max(5, Math.min(100, count * 15))}%` }}
                              >
                                  {count > 0 && (
                                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {count}
                                      </div>
                                  )}
                              </div>
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase">
                              {new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })}
                          </span>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          
          {/* Tabs Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden bg-slate-50/50">
              <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto max-w-full">
                {tabs.filter(t => !t.hidden).map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap
                            ${activeTab === tab.id 
                                ? 'bg-slate-900 text-white shadow-md' 
                                : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <tab.icon size={16}/>
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
              </div>

              {/* Export Button (Only for List Views) */}
              <div className="relative">
                  <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold shadow-sm transition-all">
                      <Download size={16}/> {t('dash.ads.export')}
                  </button>
                   {isExportMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up">
                          <button onClick={() => { exportService.toCSV(displayRequests); setIsExportMenuOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-700"><FileText size={16}/> CSV</button>
                          <button onClick={() => handlePrint()} className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 text-sm text-slate-900 font-bold"><Printer size={16}/> Print View</button>
                      </div>
                  )}
              </div>
          </div>
          
          {/* List Content */}
          <div className="overflow-x-auto">
              {displayRequests.length === 0 ? (
                  <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
                      <Inbox size={48} className="opacity-20"/>
                      <span>No requests found in this view.</span>
                  </div>
              ) : (
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-100">
                          <tr>
                              <th className="px-6 py-4 w-24 whitespace-nowrap">ID</th>
                              {activeTab !== 'MY_REQUESTS' && <th className="px-6 py-4 min-w-[200px]">Requester</th>}
                              <th className="px-6 py-4 min-w-[250px]">Destination</th>
                              <th className="px-6 py-4 w-32 whitespace-nowrap">Status</th>
                              <th className="px-6 py-4 w-32 text-right whitespace-nowrap">Cost</th>
                              <th className="px-6 py-4 w-24 text-right whitespace-nowrap">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {displayRequests.map(req => (
                              <tr key={req.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => onEdit(req)}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{formatRequestId(req.id)}</span>
                                  </td>
                                  
                                  {activeTab !== 'MY_REQUESTS' && (
                                      <td className="px-6 py-4">
                                          <div className="flex items-center gap-2">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0
                                                  ${req.requesterId === user?.id ? 'bg-blue-500' : 'bg-slate-400'}`}>
                                                  {req.requesterName.charAt(0)}
                                              </div>
                                              <div className="min-w-0">
                                                  <div className="text-sm font-bold text-slate-800 truncate">{req.requesterName}</div>
                                                  <div className="text-[10px] text-slate-400 truncate">{req.requesterId}</div>
                                              </div>
                                          </div>
                                      </td>
                                  )}

                                  <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                          {/* Visual Icon based on travel type */}
                                          <div className={`p-2 rounded-lg shrink-0 ${req.travelType === 'INTERNATIONAL' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                              <Plane size={18}/>
                                          </div>
                                          <div className="min-w-0">
                                              <div className="font-bold text-slate-800 text-sm flex items-center gap-2 truncate">
                                                  {req.trip.destination}
                                                  {req.travelType === 'INTERNATIONAL' && <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200 whitespace-nowrap">INTL</span>}
                                              </div>
                                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                  <Clock size={10}/> {formatDate(req.trip.startDate)}
                                              </div>
                                          </div>
                                      </div>
                                  </td>

                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <StatusBadge status={req.status}/>
                                      {/* SLA Badge for ADS/Manager */}
                                      {activeTab !== 'MY_REQUESTS' && req.slaDeadline && (
                                          <div className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded w-fit flex items-center gap-1
                                              ${getSLAStatus(req.slaDeadline, req.status)?.urgent ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                                              <Clock size={10}/> {getSLAStatus(req.slaDeadline, req.status)?.label}
                                          </div>
                                      )}
                                  </td>

                                  <td className="px-6 py-4 text-right whitespace-nowrap">
                                      <div className="font-bold text-slate-700">{formatCurrency(req.actualCost || req.estimatedCost)}</div>
                                      <div className="text-[10px] text-slate-400">Total</div>
                                  </td>

                                  <td className="px-6 py-4 text-right whitespace-nowrap">
                                      {/* Action Buttons based on Role & Status */}
                                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                          
                                          {/* Manager Action: Review */}
                                          {role === 'Manager' && req.status === RequestStatus.PENDING_APPROVAL && (
                                              <button onClick={() => onReview?.(req)} className="btn-action bg-orange-100 text-orange-700 hover:bg-orange-200">
                                                  Review
                                              </button>
                                          )}

                                          {/* ADS Actions */}
                                          {role === 'ADS' && (
                                              <>
                                                  {req.status === RequestStatus.SUBMITTED && (
                                                      <button onClick={() => onProcessRequest?.(req)} className="btn-action bg-blue-100 text-blue-700 hover:bg-blue-200">
                                                          Process
                                                      </button>
                                                  )}
                                                  {req.status === RequestStatus.APPROVED && (
                                                      <button onClick={() => onBookRequest?.(req)} className="btn-action bg-green-100 text-green-700 hover:bg-green-200">
                                                          Book
                                                      </button>
                                                  )}
                                              </>
                                          )}

                                          {/* Employee Actions */}
                                          {(role === 'Employee' || req.requesterId === user?.id) && (
                                              <>
                                                  {req.status === RequestStatus.WAITING_EMPLOYEE_SELECTION && (
                                                      <button onClick={() => onEdit(req)} className="btn-action bg-pink-100 text-pink-700 hover:bg-pink-200 animate-pulse">
                                                          Select Option
                                                      </button>
                                                  )}
                                                  <button onClick={() => onEdit(req)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg">
                                                      <Pencil size={16}/>
                                                  </button>
                                              </>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </div>
      </div>

      <style>{`
        .btn-action { @apply px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm; }
      `}</style>

      {/* Hidden Print Component */}
      {printRequest && (
          <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[100]">
              <PrintSingleTicket request={printRequest}/>
          </div>
      )}
    </div>
  );
};
