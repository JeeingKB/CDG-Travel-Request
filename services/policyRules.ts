
import { TravelType, TravelerDetails, FlightService, CarService, TravelPolicy } from '../types';
import { storageService } from './storage';

// --- Helper: Get Current Policy (Synchronously for Rule Logic) ---
// Note: In a real app, we might pass policy as an argument, but for simplicity we fetch from local state or updated storage
// For now, let's assume the caller passes the policy, OR we fetch default.

export const calculateMileageReimbursement = (distanceKm: number): number => {
    // 1 - 100 km : 9 THB/km
    // > 100 km : 4.5 THB/km
    // NOTE: This could be dynamic based on policy.mileageRate if passed
    if (distanceKm <= 100) {
        return distanceKm * 9;
    } else {
        const firstTier = 100 * 9;
        const remaining = distanceKm - 100;
        return firstTier + (remaining * 4.5);
    }
};

export const getDailyPerDiem = (traveler: TravelerDetails, travelType: TravelType, destinationCountry: string): { amount: number, currency: string } => {
    // In a real implementation, we would query the `policy.perDiem` array.
    // Since this function is sync and called by UI, we will fallback to hardcoded logic if policy isn't passed,
    // BUT we should refactor to use the policy object in `validatePolicy`.
    
    // Hardcoded fallback for now to prevent breaking, but `validatePolicy` below is the main engine.
    const isHighLevel = (traveler.jobGrade || 0) >= 13;
    if (travelType === TravelType.DOMESTIC) return { amount: isHighLevel ? 600 : 500, currency: 'THB' };
    
    const dest = destinationCountry.toLowerCase();
    if (dest.includes('japan') || dest.includes('singapore') || dest.includes('uk') || dest.includes('usa')) {
        return { amount: 75, currency: 'USD' };
    }
    return { amount: 50, currency: 'USD' };
};

export const getHotelLimit = (destinationCity: string, travelType: TravelType): number => {
    // This is just a helper for the Form's initial estimate.
    // Real validation happens in `validatePolicy` with full Policy object.
    return travelType === TravelType.DOMESTIC ? 2000 : 5000;
};

// --- CORE VALIDATION ENGINE ---

export const validatePolicy = (
    travelType: TravelType,
    destination: string,
    traveler: TravelerDetails,
    flight?: FlightService,
    hotel?: { pricePerNight: number, location: string },
    car?: CarService
): string[] => {
    const violations: string[] = [];
    
    // FETCH POLICY SYNC (From LocalStorage for immediate validation)
    // Ideally passed as prop, but direct fetch is acceptable for this scale
    const settingsStr = localStorage.getItem('cdg-travel-policy');
    if (!settingsStr) return [];
    const policy: TravelPolicy = JSON.parse(settingsStr);

    const jobGrade = traveler.jobGrade || 10;

    // 1. FLIGHT VALIDATION
    if (flight) {
        // Find applicable rule
        // Rules are usually: If grade >= X AND duration > Y -> Cabin Allowed
        const duration = flight.durationHours || 0;
        
        // Check for specific rule permitting this cabin
        const allowedRule = policy.flightRules.find(r => 
            r.applicableJobGrades.includes(jobGrade) && 
            duration >= r.minDurationHours && 
            isCabinAllowed(flight.flightClass, r.allowedCabin)
        );

        if (!allowedRule) {
            // If no rule explicitly allows this, it might be a violation
            // Check if they are booking higher than Economy
            if (flight.flightClass !== 'Economy') {
                 // Check if ANY rule for this grade allows this cabin
                 const anyRuleForGrade = policy.flightRules.some(r => r.applicableJobGrades.includes(jobGrade) && r.allowedCabin === flight.flightClass);
                 if (!anyRuleForGrade) {
                     violations.push(`Job Grade ${jobGrade} is not eligible for ${flight.flightClass} class.`);
                 } else {
                     // Grade allows it, but maybe duration is too short?
                     violations.push(`${flight.flightClass} only allowed for flights > 6 hours (Current: ${duration}h).`);
                 }
            }
        }
    }

    // 2. HOTEL VALIDATION
    if (hotel) {
        let limit = travelType === 'DOMESTIC' ? policy.defaultHotelLimit.domestic : policy.defaultHotelLimit.international;
        
        // Check for Specific City Tiers
        const tier = policy.hotelTiers.find(t => t.cities.some(c => hotel.location.includes(c)));
        if (tier) {
            limit = tier.limitPerNight;
        }

        if (hotel.pricePerNight > limit) {
             violations.push(`Hotel limit for ${hotel.location} is ${limit} ${tier ? tier.currency : 'THB'}. (Requested: ${hotel.pricePerNight})`);
        }
    }

    // 3. MILEAGE
    if (car && car.mileageDistance) {
        if (car.mileageDistance > 800) {
            violations.push('Mileage claim > 800km. Please consider flight.');
        }
    }

    return violations;
};

// Helper: Cabin Hierarchy
function isCabinAllowed(requested: string, allowed: string): boolean {
    const ranks = ['Economy', 'Premium Economy', 'Business', 'First'];
    const reqIdx = ranks.indexOf(requested);
    const allowIdx = ranks.indexOf(allowed);
    return reqIdx <= allowIdx; // Requested must be <= Allowed
}

export const getApprovalFlow = (requester: TravelerDetails, totalCost: number, policy?: TravelPolicy): string[] => {
    // Fallback if policy not passed
    let p = policy;
    if (!p) {
        const str = localStorage.getItem('cdg-travel-policy');
        if (str) p = JSON.parse(str);
    }
    
    const deptHeadLimit = p?.doa?.departmentHeadThreshold ?? 50000;
    const execLimit = p?.doa?.executiveThreshold ?? 200000;

    const flow = ['Line Manager'];

    // Level 2 Approval
    if (totalCost > deptHeadLimit) {
        flow.push('Department Head');
    }
    
    // Level 3 Approval (C-Level)
    if (totalCost > execLimit || requester.position === 'GM') {
        flow.push('CFO / COO');
    }

    return flow;
};
