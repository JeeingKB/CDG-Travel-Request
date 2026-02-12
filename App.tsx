
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { NewRequestForm } from './components/NewRequestForm';
import { ChatAssistant } from './components/ChatAssistant';
import { ProcessRequestModal } from './components/ProcessRequestModal';
import { PolicySettings } from './components/PolicySettings'; 
import { RequestList } from './components/RequestList'; 
import { ApprovalModal } from './components/ApprovalModal';
import { TravelRequest, ViewState, UserRole, RequestStatus } from './types';
import { storageService } from './services/storage';
import { calculateSLADeadline } from './services/slaService'; 
import { LanguageProvider } from './services/translations'; // Import Provider

function AppContent() {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [editingRequest, setEditingRequest] = useState<Partial<TravelRequest> | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Role Management State
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('Employee');
  
  // ADS Workflow State
  const [processingRequest, setProcessingRequest] = useState<TravelRequest | null>(null);
  
  // Manager Workflow State
  const [reviewingRequest, setReviewingRequest] = useState<TravelRequest | null>(null);

  // Load data (CRUD: Read)
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        const data = await storageService.getRequests();
        setRequests(data);
        setIsLoading(false);
    };
    loadData();
  }, []);

  // CRUD: Create / Update
  // Added 'keepOpen' parameter to allow saving without closing the modal/form
  const handleSaveRequest = async (request: TravelRequest, keepOpen: boolean = false) => {
    if (!request.status || request.status === RequestStatus.DRAFT) {
        request.status = RequestStatus.SUBMITTED;
    }
    const updatedList = await storageService.saveRequest(request);
    setRequests(updatedList);
    
    if (!keepOpen) {
        setView('DASHBOARD');
        setEditingRequest(null);
        setProcessingRequest(null); 
    } else {
        // If keeping open, we must update the specific state object 
        // so the UI reflects the changes (e.g., status change in Modal)
        if (processingRequest && processingRequest.id === request.id) {
            setProcessingRequest(request);
        }
        if (editingRequest && editingRequest.id === request.id) {
            setEditingRequest(request);
        }
    }
  };

  // Direct Create from Chat
  const handleCreateFromChat = async (draftData: Partial<TravelRequest>): Promise<TravelRequest> => {
      const newId = `TR-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
      const submissionTime = new Date().toISOString();
      
      const newRequest: TravelRequest = {
          id: newId,
          requesterId: draftData.requesterId || 'EMP001', 
          requesterName: draftData.requesterName || 'Alex Bennett',
          requestFor: draftData.requestFor || ('SELF' as any),
          travelType: draftData.travelType || ('DOMESTIC' as any),
          travelers: draftData.travelers || [],
          trip: draftData.trip || { 
              origin: 'Bangkok', destination: '', startDate: '', endDate: '', 
              purpose: 'Requested via Chat', justification: '', projectCode: '', costCenter: '' 
          },
          services: draftData.services || [],
          estimatedCost: draftData.estimatedCost || 0,
          status: RequestStatus.SUBMITTED,
          submittedAt: submissionTime,
          slaDeadline: calculateSLADeadline(submissionTime, draftData.travelType || ('DOMESTIC' as any))
      };

      const updatedList = await storageService.saveRequest(newRequest);
      setRequests(updatedList);
      return newRequest;
  };
  
  // NEW: Update Status from Chat
  const handleStatusUpdateFromChat = async (id: string, newStatus: string): Promise<TravelRequest | null> => {
      // Find request
      const req = requests.find(r => r.id === id);
      if (!req) return null;

      // Validate Status Enum
      let validStatus: RequestStatus | null = null;
      if (Object.values(RequestStatus).includes(newStatus as RequestStatus)) {
          validStatus = newStatus as RequestStatus;
      } else {
          // Fuzzy match or default mapping
          if (newStatus.toLowerCase().includes('approve')) validStatus = RequestStatus.APPROVED;
          else if (newStatus.toLowerCase().includes('reject')) validStatus = RequestStatus.REJECTED;
          else if (newStatus.toLowerCase().includes('cancel')) validStatus = RequestStatus.REJECTED; // Or Cancelled if exists
      }

      if (validStatus) {
          const updated = { ...req, status: validStatus };
          const updatedList = await storageService.saveRequest(updated);
          setRequests(updatedList);
          return updated;
      }
      return null;
  };

  // CRUD: Delete
  const handleDeleteRequest = async (id: string) => {
    if (window.confirm('Delete this request?')) {
      const updatedList = await storageService.deleteRequest(id);
      setRequests(updatedList);
    }
  };

  const handleEditRequest = (request: TravelRequest) => {
    setEditingRequest(request);
    setView('NEW_REQUEST');
  };

  const handleDraftFromAI = (data: Partial<TravelRequest>) => {
    setEditingRequest(data);
    setView('NEW_REQUEST');
    setIsChatOpen(false);
  };
  
  // --- Manager Handlers ---
  const handleApproveRequest = async (req: TravelRequest) => {
      const updated = { ...req, status: RequestStatus.APPROVED };
      await handleSaveRequest(updated);
      setReviewingRequest(null);
  };

  const handleRejectRequest = async (req: TravelRequest, reason: string) => {
      const updated = { ...req, status: RequestStatus.REJECTED, policyExceptionReason: `Rejected: ${reason}` };
      await handleSaveRequest(updated);
      setReviewingRequest(null);
  };

  const handleSendBackRequest = async (req: TravelRequest, reason: string) => {
      const updated = { ...req, status: RequestStatus.QUOTATION_PENDING, policyExceptionReason: `Sent Back: ${reason}` };
      await handleSaveRequest(updated);
      setReviewingRequest(null);
  };


  if (isLoading && view === 'DASHBOARD' && requests.length === 0) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading Data...</div>;
  }

  return (
    <Layout activeView={view} onNavigate={(v) => {
        if (v === 'NEW_REQUEST') setEditingRequest(null);
        setView(v);
    }}>
      {/* Role Switcher for Demo Purposes */}
      <div className="fixed bottom-4 left-20 z-50 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded-xl shadow-lg flex gap-2 print:hidden">
         {['Employee', 'ADS', 'Manager'].map((role) => (
             <button
               key={role}
               onClick={() => setCurrentUserRole(role as UserRole)}
               className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${currentUserRole === role ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
             >
                 {role}
             </button>
         ))}
      </div>

      {view === 'DASHBOARD' && (
        <Dashboard 
          onRequestNew={() => {
            setEditingRequest(null);
            setView('NEW_REQUEST');
          }} 
          onTalkToAI={() => setIsChatOpen(true)}
          requests={requests}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
          role={currentUserRole}
          onProcessRequest={(req) => setProcessingRequest(req)}
          onViewAllRequests={() => setView('MY_REQUESTS')}
          onReview={(req) => setReviewingRequest(req)}
        />
      )}
      
      {view === 'NEW_REQUEST' && (
        <NewRequestForm 
          initialData={editingRequest}
          onCancel={() => {
            setEditingRequest(null);
            setView('DASHBOARD');
          }}
          onSubmit={(req) => handleSaveRequest(req, false)} // Allow edit save without force close if needed, or stick to true
        />
      )}

      {view === 'MY_REQUESTS' && (
        <RequestList 
           requests={requests}
           onEdit={handleEditRequest}
           onDelete={handleDeleteRequest}
        />
      )}

      {view === 'SETTINGS' && (
        <PolicySettings />
      )}

      <ChatAssistant 
        isOpen={isChatOpen} 
        onOpen={() => setIsChatOpen(true)}
        onClose={() => setIsChatOpen(false)}
        onDraftRequest={handleDraftFromAI}
        onCreateRequest={handleCreateFromChat}
        onUpdateStatus={handleStatusUpdateFromChat} // Pass the handler
        existingRequests={requests} 
      />

      {processingRequest && (
          <ProcessRequestModal 
             request={processingRequest}
             onClose={() => setProcessingRequest(null)}
             onUpdate={handleSaveRequest}
          />
      )}

      {reviewingRequest && (
          <ApprovalModal
              request={reviewingRequest}
              onClose={() => setReviewingRequest(null)}
              onApprove={handleApproveRequest}
              onReject={handleRejectRequest}
              onSendBack={handleSendBackRequest}
          />
      )}
    </Layout>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
