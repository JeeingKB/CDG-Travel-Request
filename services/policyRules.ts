
import { TravelType, TravelerDetails, FlightService, CarService, TravelPolicy, DOARule, ComplexRule } from '../types';
import { storageService } from './storage';

export const calculateMileageReimbursement = (distanceKm: number): number => {
    // 1 - 100 km : 9 THB/km
    // > 100 km : 4.5 THB/km
    if (distanceKm <= 100) {
        return distanceKm * 9;
    } else {
        const firstTier = 100 * 9;
        const remaining = distanceKm - 100;
        return firstTier + (remaining * 4.5);
    }
};

export const getDailyPerDiem = (traveler: TravelerDetails, travelType: TravelType, destinationCountry: string): { amount: number, currency: string } => {
    // Ideally, check `complexRules` here too, but keeping simple fallback
    const isHighLevel = (traveler?.jobGrade || 0) >= 13;
    if (travelType === TravelType.DOMESTIC) return { amount: isHighLevel ? 600 : 500, currency: 'THB' };
    
    const dest = destinationCountry.toLowerCase();
    if (dest.includes('japan') || dest.includes('singapore') || dest.includes('uk') || dest.includes('usa')) {
        return { amount: 75, currency: 'USD' };
    }
    return { amount: 50, currency: 'USD' };
};

export const getHotelLimit = (destinationCity: string, travelType: TravelType): number => {
    return travelType === TravelType.DOMESTIC ? 2000 : 5000;
};

// --- HELPER: MATCH RULE ---
// Check if a complex rule applies to the current traveler/trip
const isRuleApplicable = (rule: ComplexRule, traveler: TravelerDetails, tripDuration: number, tripType: TravelType): boolean => {
    // 1. Company Check
    if (rule.companyId !== 'ALL' && rule.companyId !== traveler.companyId) return false;

    // 2. Grade Check
    if (rule.minJobGrade !== undefined && (traveler.jobGrade || 0) < rule.minJobGrade) return false;
    if (rule.maxJobGrade !== undefined && (traveler.jobGrade || 0) > rule.maxJobGrade) return false;

    // 3. Travel Type Check
    if (rule.travelType && rule.travelType !== 'ALL' && rule.travelType !== tripType) return false;

    // 4. Duration Check (Only for flights)
    if (rule.minDurationHours !== undefined && tripDuration < rule.minDurationHours) return false;

    return true;
};

// --- CORE VALIDATION ENGINE (MATRIX SUPPORT) ---

export const validatePolicy = (
    travelType: TravelType,
    destination: string,
    traveler: TravelerDetails,
    flight?: FlightService,
    hotel?: { pricePerNight: number, location: string },
    car?: CarService
): string[] => {
    if (!traveler) return [];

    const violations: string[] = [];
    
    // FETCH POLICY SYNC
    const settingsStr = localStorage.getItem('cdg-travel-policy');
    if (!settingsStr) return [];
    const policy: TravelPolicy = JSON.parse(settingsStr);

    const companyId = traveler.companyId || 'CDG'; // Default if missing

    // 1. FLIGHT VALIDATION
    if (flight) {
        const duration = flight.durationHours || 0;
        
        // Find ALL applicable rules for FLIGHT_CLASS matching this traveler
        // Sort by specific conditions? (Usually highest grade rule wins)
        const rules = policy.complexRules.filter(r => 
            r.category === 'FLIGHT_CLASS' && 
            isRuleApplicable(r, traveler, duration, travelType)
        );

        // Logic: If NO rule matches, default to Economy.
        // If rules match, take the "best" allowed class (assuming Business > Eco).
        // OR simply: If user requested X, is there a rule allowing X?
        
        const requestedClass = flight.flightClass;
        
        // Is there a rule explicitly allowing this class (or better)?
        const isAllowed = rules.some(r => isCabinAllowed(requestedClass, r.allowedValue as string));
        
        // Fallback: If no rules found, assume Economy is allowed only.
        const effectiveAllowed = rules.length > 0 ? 'See Rules' : 'Economy';

        if (rules.length === 0 && requestedClass !== 'Economy') {
             violations.push(`No policy found allowing ${requestedClass} for your grade/company. Default is Economy.`);
        } else if (rules.length > 0 && !isAllowed) {
             violations.push(`Policy does not permit ${requestedClass}. (Allowed: ${rules.map(r => r.allowedValue).join(' or ')})`);
        }
    }

    // 2. HOTEL VALIDATION
    if (hotel) {
        // Find applicable HOTEL_LIMIT rules
        const rules = policy.complexRules.filter(r => 
            r.category === 'HOTEL_LIMIT' && 
            isRuleApplicable(r, traveler, 0, travelType)
        );

        let limit = travelType === 'DOMESTIC' ? policy.defaultHotelLimit.domestic : policy.defaultHotelLimit.international;
        
        // Override with specific rule if found
        if (rules.length > 0) {
            // Take the max limit if multiple rules apply? Or the first? Let's take first match.
            limit = Number(rules[0].allowedValue);
        }

        if (hotel.pricePerNight > limit) {
             violations.push(`Hotel limit for ${companyId}/${travelType} is ${limit}. (Requested: ${hotel.pricePerNight})`);
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

// --- DOA MATRIX ENGINE ---

export const getApprovalFlow = (requester: TravelerDetails, totalCost: number, policy?: TravelPolicy): string[] => {
    if (!requester) return ['Line Manager'];

    // Fallback if policy not passed
    let p = policy;
    if (!p) {
        const str = localStorage.getItem('cdg-travel-policy');
        if (str) p = JSON.parse(str);
    }
    
    if (!p || !p.doaMatrix) return ['Line Manager'];

    const companyId = requester.companyId || 'CDG';
    
    // Filter rules for this company
    // Then find the matching cost range
    // Sort by priority (if multiple match, lower priority # wins/first match wins)
    const applicableRule = p.doaMatrix
        .filter(r => r.companyId === companyId)
        .filter(r => {
            // Check Cost Range
            if (totalCost < r.minCost) return false;
            if (r.maxCost !== -1 && totalCost > r.maxCost) return false;
            return true;
        })
        .sort((a, b) => a.priority - b.priority)[0]; // Get top priority match

    if (applicableRule) {
        return applicableRule.approverChain;
    }

    // Default fallback if no matrix match found
    return ['Line Manager', 'Admin Verification']; 
};
