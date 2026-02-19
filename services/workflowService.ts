
import { TravelRequest, RequestStatus, ApprovalLog, TravelerDetails } from '../types';
import { getApprovalFlow } from './policyRules';

export const workflowService = {
    /**
     * Determines the next state of a request after an approval action.
     * Supports Multi-level DOA: Line Manager -> Dept Head -> CFO.
     */
    approveRequest: (
        request: TravelRequest, 
        approver: TravelerDetails, 
        comments?: string
    ): TravelRequest => {
        // 1. Snapshot the required chain if not already present
        let chain = request.requiredApprovalChain;
        if (!chain || chain.length === 0) {
            // Need the original requester details to recalculate flow? 
            // In a real app, we'd fetch the requester profile. Here we approximate or use what's in request.travelers[0] if available.
            // However, getApprovalFlow needs a TravelerDetails object.
            // For safety, if chain is missing, we default to simple approval.
            chain = ['Line Manager']; 
        }

        // 2. Identify Current Step
        const currentRole = request.currentApproverRole || chain[0];
        const currentStepIndex = chain.indexOf(currentRole);

        // 3. Create Audit Log Entry
        const logEntry: ApprovalLog = {
            id: `LOG-${Date.now()}`,
            approverId: approver.id,
            approverName: approver.name,
            role: approver.position || 'Approver',
            action: 'APPROVED',
            timestamp: new Date().toISOString(),
            comments: comments
        };

        const newHistory = [...(request.approvalHistory || []), logEntry];

        // 4. Determine Next Step
        let nextStatus = request.status;
        let nextRole = currentRole;

        if (currentStepIndex < chain.length - 1) {
            // Move to next approver
            nextRole = chain[currentStepIndex + 1];
            nextStatus = RequestStatus.PENDING_APPROVAL; // Still pending
        } else {
            // Chain complete
            nextStatus = RequestStatus.APPROVED;
            nextRole = 'Completed';
        }

        return {
            ...request,
            status: nextStatus,
            approvalHistory: newHistory,
            currentApproverRole: nextRole,
            requiredApprovalChain: chain // Ensure chain is persisted
        };
    },

    rejectRequest: (
        request: TravelRequest, 
        approver: TravelerDetails, 
        reason: string
    ): TravelRequest => {
        const logEntry: ApprovalLog = {
            id: `LOG-${Date.now()}`,
            approverId: approver.id,
            approverName: approver.name,
            role: approver.position || 'Approver',
            action: 'REJECTED',
            timestamp: new Date().toISOString(),
            comments: reason
        };

        return {
            ...request,
            status: RequestStatus.REJECTED,
            approvalHistory: [...(request.approvalHistory || []), logEntry],
            policyExceptionReason: `Rejected by ${approver.name}: ${reason}`
        };
    },

    sendBackRequest: (
        request: TravelRequest, 
        approver: TravelerDetails, 
        reason: string
    ): TravelRequest => {
        const logEntry: ApprovalLog = {
            id: `LOG-${Date.now()}`,
            approverId: approver.id,
            approverName: approver.name,
            role: approver.position || 'Approver',
            action: 'SENT_BACK',
            timestamp: new Date().toISOString(),
            comments: reason
        };

        return {
            ...request,
            status: RequestStatus.QUOTATION_PENDING, // Send back to ADS/Selection phase
            approvalHistory: [...(request.approvalHistory || []), logEntry],
            policyExceptionReason: `Sent Back by ${approver.name}: ${reason}`
        };
    },

    /**
     * Initializes the approval chain when a user selects a quote (Submit for Approval).
     */
    initializeApprovalChain: (
        request: TravelRequest,
        requesterProfile: TravelerDetails,
        totalCost: number
    ): TravelRequest => {
        const chain = getApprovalFlow(requesterProfile, totalCost);
        return {
            ...request,
            requiredApprovalChain: chain,
            currentApproverRole: chain[0],
            approvalHistory: [] // Reset history for new submission? Or keep? Usually reset or keep as "Version 1"
        };
    }
};
