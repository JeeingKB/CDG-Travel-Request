
export type UserRole = 'Employee' | 'Manager' | 'ADS';

export enum TravelType {
  DOMESTIC = 'DOMESTIC',
  INTERNATIONAL = 'INTERNATIONAL',
}

export enum RequestFor {
  SELF = 'SELF',
  EMPLOYEE = 'EMPLOYEE',
  CLIENT = 'CLIENT',
}

export enum RequestStatus {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted', // Sent by Employee, Waiting for ADS
  QUOTATION_PENDING = 'Quotation Pending', // ADS sent email to vendor
  PENDING_APPROVAL = 'Pending Approval', // ADS updated price, sent to Manager
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  BOOKED = 'Booked',
  COMPLETED = 'Completed',
}

// --- System Configuration ---
export type ApiProvider = 'GEMINI' | 'OPENAI' | 'CUSTOM' | 'MOCK';
export type DatabaseProvider = 'LOCAL_STORAGE' | 'REST_API' | 'SUPABASE';
export type AppFeature = 'CHAT' | 'OCR' | 'JUSTIFICATION' | 'POLICY' | 'DOC_GEN';

export interface ApiConfig {
  gemini: {
    apiKey: string;
    model: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  custom: {
    endpoint: string; // Base URL
    apiKey: string;
    model: string;
  };
}

export interface DatabaseConfig {
  endpoint: string; // e.g., https://api.corp.cdg/v1
  apiKey: string;
  supabaseUrl?: string; // NEW
  supabaseKey?: string; // NEW
}

export interface SystemSettings {
  // apiProvider: ApiProvider; // Removed in favor of featureMapping
  featureMapping: Record<AppFeature, ApiProvider>; // NEW: Map specific features to providers
  latencySimulation: number; // ms to delay mock response
  apiConfigs: ApiConfig;
  databaseProvider: DatabaseProvider;
  databaseConfig: DatabaseConfig;
}

// --- Agency / Vendor Interface ---
export interface Agency {
  id: string;
  name: string;
  email: string;
  contactPerson?: string;
  type: 'Full Service' | 'Low Cost' | 'Hotel Specialist' | 'Car Rental';
  isPreferred: boolean;
}

// --- COMPLEX POLICY INTERFACES ---

export interface FlightRule {
  minDurationHours: number; // e.g. 0 for Short, 6 for Long
  allowedCabin: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  applicableJobGrades: number[]; // e.g. [10, 11, 12] vs [13, 14, 15]
}

export interface HotelTier {
  zoneName: string; // e.g. "Tier 1 Cities (NY, London, Tokyo)"
  cities: string[]; // List of specific cities
  limitPerNight: number;
  currency: 'THB' | 'USD';
}

export interface PerDiemRule {
  region: 'Domestic' | 'International_Tier1' | 'International_General';
  amount: number;
  currency: 'THB' | 'USD';
}

// --- Policy Configuration Interface ---
export interface TravelPolicy {
  // 1. Flight Policy (Complex)
  flightRules: FlightRule[];
  
  // 2. Hotel Policy (Complex)
  hotelTiers: HotelTier[];
  defaultHotelLimit: {
    domestic: number;
    international: number;
  };

  // 3. Booking Rules
  advanceBookingDays: {
    domestic: number;
    international: number;
  };

  // 4. Allowance
  perDiem: PerDiemRule[];

  // 5. DOA / Approval
  doa: {
    departmentHeadThreshold: number; // Amount that triggers Dept Head approval
    executiveThreshold: number;      // Amount that triggers CFO/COO approval
  };
  
  // 6. Mileage
  mileageRate: number; // THB per KM
}

// --- Service Interfaces ---
export type ServiceType = 'FLIGHT' | 'HOTEL' | 'CAR' | 'INSURANCE' | 'EVENT';

export interface ServiceBase {
  id: string;
  type: ServiceType;
  actualCost?: number; // Added to track individual service cost from vendor
  bookingReference?: string; // PNR or Reservation #
}

export interface FlightService extends ServiceBase {
  type: 'FLIGHT';
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  from: string; // IATA Code or City
  to: string;   // IATA Code or City
  departureDate: string;
  departureTimeSlot?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  exactDepartureTime?: string; // Actual time
  returnDate?: string;
  returnTimeSlot?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  exactReturnTime?: string; // Actual time
  flightClass: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  airlinePreference?: string;
  flightNumber?: string; // Actual Flight
  frequentFlyerNumber?: string;
  durationHours?: number; // Added for Policy Check (Rule 1.2.2)
}

export interface HotelService extends ServiceBase {
  type: 'HOTEL';
  location: string; // City or Area
  hotelName?: string; // Actual Hotel Name
  address?: string; // Actual Address
  checkIn: string;
  checkOut: string;
  roomType: 'Standard' | 'Deluxe' | 'Suite' | 'Executive';
  guests: number;
  breakfastIncluded: boolean;
  specialRequests?: string;
}

export interface CarService extends ServiceBase {
  type: 'CAR';
  pickupLocation: string;
  dropoffLocation: string; // Can be different
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
  carType: 'Eco' | 'Sedan' | 'SUV' | 'Van' | 'Luxury';
  driverIncluded: boolean;
  mileageDistance?: number; // For Personal Car mileage claim (Rule 2.2.2)
}

export interface InsuranceService extends ServiceBase {
  type: 'INSURANCE';
  coverageType: 'Basic' | 'Comprehensive' | 'Worldwide';
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface EventService extends ServiceBase {
  type: 'EVENT';
  eventName: string;
  location: string;
  date: string;
  ticketType: string;
  notes?: string;
}

export type TravelServiceItem = FlightService | HotelService | CarService | InsuranceService | EventService;

// --- Master Data ---
export interface Project {
  code: string;
  name: string;
  manager: string;
  budget: number;
  spent: number;
  status: 'Active' | 'Closed';
}

export interface CostCenter {
  code: string;
  name: string;
  department: string;
  budget: number;
  available: number;
}

export interface TravelerDetails {
  id: string; // Employee ID or UUID for guest
  title: 'Mr.' | 'Ms.' | 'Mrs.' | 'Dr.';
  name: string; // Full Name
  type: 'Employee' | 'Guest';
  email?: string;
  department?: string; // For Employee
  company?: string; // For Guest
  mobile?: string;
  dateOfBirth?: string; // Required for flights
  passportNumber?: string; // For International
  passportExpiry?: string;
  nationalId?: string; // For Domestic Flights (sometimes required)
  
  // Added for Policy Logic
  jobGrade?: number; // e.g., 10, 13
  position?: 'MD' | 'GM' | 'AMD' | 'AGM' | 'Manager' | 'Staff' | 'Other';
}

// --- Main Request ---
export interface TripSummary {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  purpose: string;
  justification: string;
  projectCode: string;
  costCenter: string;
}

export interface TravelRequest {
  id: string;
  requesterId: string; // Who created the request
  requesterName: string;
  
  requestFor: RequestFor; // Who is it for?
  travelType: TravelType;
  
  travelers: TravelerDetails[]; // List of all people traveling
  
  trip: TripSummary; // High level summary
  services: TravelServiceItem[]; // Detailed bookings
  
  status: RequestStatus;
  
  // Financials
  estimatedCost: number; // Initial guess by Employee
  actualCost?: number;   // Updated by ADS from Vendor
  
  // ADS Workflow
  vendorQuotationSentAt?: string;
  vendorQuotationReceivedAt?: string;
  sentToAgencies?: string[]; // IDs of agencies emailed
  
  submittedAt?: string;
  
  // SLA Tracking
  slaDeadline?: string; // Timestamp when ADS must complete the task
  
  policyFlags?: string[];
  policyExceptionReason?: string; // If ADS overrides policy
}

// Generic Data container for Chat Actions
export interface ChatActionData extends Partial<TravelRequest> {
    generatedDoc?: { name: string, type: string };
    merchant?: string;
    amount?: number;
    currency?: string;
    date?: string;
    convertedAmount?: number;
    submittedRequest?: TravelRequest;
    doa?: string[];
    policyStatus?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  type?: 'text' | 'receipt_analysis';
  action?: 'DRAFT_CREATED' | 'EXPENSE_ADDED';
  data?: ChatActionData; // Strict type instead of 'any'
  attachment?: {
    name: string;
    url: string;
    type: 'image' | 'file';
  };
}

export type ViewState = 'DASHBOARD' | 'NEW_REQUEST' | 'MY_REQUESTS' | 'APPROVALS' | 'EXPENSES' | 'ADS_PROCESS' | 'SETTINGS';
