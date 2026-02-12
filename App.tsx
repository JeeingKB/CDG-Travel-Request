
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { NewRequestForm } from './components/NewRequestForm';
import { ChatAssistant } from './components/ChatAssistant';
import { ProcessRequestModal } from './components/ProcessRequestModal';
import { PolicySettings } from './components/PolicySettings'; 
import { RequestList } from './components/RequestList'; 
import { ApprovalModal } from './components/ApprovalModal';
import { QuotationSelectionModal } from './components/QuotationSelectionModal';
import { LoginPage } from './components/LoginPage'; // NEW
import { AuthProvider, useAuth } from './contexts/AuthContext'; // NEW
import { TravelRequest, ViewState, RequestStatus } from './types';
import { storageService } from './services/storage';
import { calculateSLADeadline } from './services/slaService'; 
import { LanguageProvider } from './services/translations'; 

function AppContent() {
  const { user, isLoading: authLoading, userRole } = useAuth(); // Get real user state
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [editingRequest, setEditingRequest] = useState<Partial<TravelRequest> | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // ADS Workflow State
  const [processingRequest, setProcessingRequest] = useState<TravelRequest | null>(null);
  
  // Manager Workflow State
  const [reviewingRequest, setReviewingRequest] = useState<TravelRequest | null>(null);

  // Employee Selection Workflow State
  const [selectionRequest, setSelectionRequest] = useState<TravelRequest | null>(null);

  // Load data (CRUD: Read)
  useEffect(() => {
    if (!user) return; // Only load if logged in

    const loadData = async () => {
        setIsLoading(true);
        const data = await storageService.getRequests();
        setRequests(data);
        setIsLoading(false);
    };
    loadData();
  }, [user]); // Reload when user logs in

  // CRUD: Create / Update
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
        setSelectionRequest(null); // Close selection modal if open
    } else {
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
          requesterId: user?.id || 'EMP001', 
          requesterName: user?.user_metadata?.full_name || 'User',
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
      const req = requests.find(r => r.id === id);
      if (!req) return null;

      let validStatus: RequestStatus | null = null;
      if (Object.values(RequestStatus).includes(newStatus as RequestStatus)) {
          validStatus = newStatus as RequestStatus;
      } else {
          if (newStatus.toLowerCase().includes('approve')) validStatus = RequestStatus.APPROVED;
          else if (newStatus.toLowerCase().includes('reject')) validStatus = RequestStatus.REJECTED;
          else if (newStatus.toLowerCase().includes('cancel')) validStatus = RequestStatus.REJECTED; 
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
      // Optimistic Update: Remove from UI immediately
      setRequests(prev => prev.filter(r => r.id !== id));
      
      try {
          const updatedList = await storageService.deleteRequest(id);
          if (updatedList.find(r => r.id === id)) {
              if (updatedList.length < requests.length) {
                  setRequests(updatedList);
              }
          } else {
              setRequests(updatedList);
          }
      } catch (error) {
          console.error("Failed to delete request:", error);
          alert("Failed to delete from server.");
      }
    }
  };

  const handleEditRequest = (request: TravelRequest) => {
    if (request.status === RequestStatus.WAITING_EMPLOYEE_SELECTION && userRole === 'Employee') {
        setSelectionRequest(request);
    } else {
        setEditingRequest(request);
        setView('NEW_REQUEST');
    }
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

  // --- Employee Selection Handler ---
  const handleEmployeeSelection = async (req: TravelRequest, optionId: string) => {
      const selectedOption = req.quotations?.find(q => q.id === optionId);
      if (!selectedOption) return;

      const updatedQuotes = req.quotations?.map(q => ({...q, isSelected: q.id === optionId}));

      const updatedReq: TravelRequest = {
          ...req,
          quotations: updatedQuotes,
          services: selectedOption.services, // Apply selected services to main record
          actualCost: selectedOption.totalAmount, // Update actual cost
          status: RequestStatus.PENDING_APPROVAL
      };
      
      await handleSaveRequest(updatedReq);
      setSelectionRequest(null);
  };

  // --- AUTH GUARD ---
  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin text-slate-400 rounded-full h-8 w-8 border-b-2 border-current"></div></div>;
  if (!user) return <LoginPage />;

  if (isLoading && view === 'DASHBOARD' && requests.length === 0) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading Dashboard...</div>;
  }

  return (
    <Layout activeView={view} onNavigate={(v) => {
        if (v === 'NEW_REQUEST') setEditingRequest(null);
        setView(v);
    }}>
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
          role={userRole} // USE REAL ROLE
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
          onSubmit={(req) => handleSaveRequest(req, false)} 
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
        onUpdateStatus={handleStatusUpdateFromChat} 
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

      {selectionRequest && (
          <QuotationSelectionModal 
              request={selectionRequest}
              onClose={() => setSelectionRequest(null)}
              onSelect={handleEmployeeSelection}
          />
      )}
    </Layout>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
