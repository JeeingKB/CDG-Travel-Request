
import { RequestStatus, RequestFor, TravelType } from '../types';

/**
 * Returns Tailwind classes for Request Status Badges
 */
export const getStatusStyle = (status: RequestStatus | string): string => {
  switch (status) {
    case RequestStatus.APPROVED:
    case RequestStatus.BOOKED:
    case RequestStatus.COMPLETED:
      return 'bg-green-100 text-green-700 border-green-200';
    
    case RequestStatus.REJECTED:
      return 'bg-red-100 text-red-700 border-red-200';
    
    case RequestStatus.PENDING_APPROVAL:
      return 'bg-orange-100 text-orange-700 border-orange-200';
      
    case RequestStatus.SUBMITTED:
      return 'bg-blue-100 text-blue-700 border-blue-200';

    case RequestStatus.WAITING_EMPLOYEE_SELECTION:
      return 'bg-pink-100 text-pink-700 border-pink-200 animate-pulse';

    case RequestStatus.QUOTATION_PENDING:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';

    case RequestStatus.DRAFT:
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

/**
 * Returns Tailwind classes for Travel Type (Domestic vs International)
 */
export const getTravelTypeStyle = (type: TravelType | string): string => {
  return type === TravelType.INTERNATIONAL 
    ? 'bg-purple-100 text-purple-600' 
    : 'bg-blue-100 text-blue-600';
};

/**
 * Returns Tailwind classes for Request For (Self vs Employee vs Client)
 */
export const getRequestForStyle = (requestFor: RequestFor | string): string => {
  return requestFor !== RequestFor.SELF 
    ? 'bg-indigo-100 text-indigo-700' 
    : 'bg-slate-100 text-slate-600';
};
