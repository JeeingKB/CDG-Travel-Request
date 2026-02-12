
import { TravelType, RequestStatus } from '../types';

// Policy: Hours allowed for ADS to process request after submission
export const SLA_CONFIG = {
  [TravelType.DOMESTIC]: 4, // 4 Hours for Domestic
  [TravelType.INTERNATIONAL]: 24 // 24 Hours for International
};

/**
 * Calculates the deadline timestamp based on submission time and travel type.
 */
export const calculateSLADeadline = (submittedAt: string, type: TravelType): string => {
  const date = new Date(submittedAt);
  const hoursToAdd = SLA_CONFIG[type];
  date.setHours(date.getHours() + hoursToAdd);
  return date.toISOString();
};

export interface SLAStatus {
  expired: boolean;
  label: string;
  colorClass: string;
  iconColor: string;
  urgent: boolean;
}

/**
 * Determines the current status of the SLA (On Track, Warning, Breached)
 */
export const getSLAStatus = (deadlineStr?: string, status?: RequestStatus): SLAStatus | null => {
  if (!deadlineStr) return null;
  
  // If request is already past the ADS stage, SLA is effectively met/irrelevant for display
  if (status && status !== RequestStatus.SUBMITTED && status !== RequestStatus.QUOTATION_PENDING) {
     return {
         expired: false,
         label: 'SLA Met',
         colorClass: 'bg-slate-100 text-slate-500 border-slate-200',
         iconColor: 'text-slate-400',
         urgent: false
     };
  }

  const deadline = new Date(deadlineStr).getTime();
  const now = new Date().getTime();
  const diff = deadline - now;

  // Breached
  if (diff <= 0) {
      const hoursOver = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
      return { 
          expired: true, 
          label: `SLA Breached (-${hoursOver}h)`, 
          colorClass: 'bg-red-100 text-red-700 border-red-200 animate-pulse',
          iconColor: 'text-red-600',
          urgent: true
      };
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  // Critical (< 2 hours)
  if (hours < 2) {
      return { 
          expired: false, 
          label: `Due in ${hours}h ${minutes}m`, 
          colorClass: 'bg-orange-100 text-orange-700 border-orange-200',
          iconColor: 'text-orange-600',
          urgent: true
      };
  }

  // On Track
  return { 
      expired: false, 
      label: `Due in ${hours}h ${minutes}m`, 
      colorClass: 'bg-green-100 text-green-700 border-green-200',
      iconColor: 'text-green-600',
      urgent: false
  };
};
