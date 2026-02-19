
export type UserRole = 'Employee' | 'Manager' | 'ADS' | 'President' | 'IT_ADMIN';

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
  WAITING_EMPLOYEE_SELECTION = 'Waiting Selection', // NEW: ADS sent options to Employee
  PENDING_APPROVAL = 'Pending Approval', // Option selected, sent to Manager
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  BOOKED = 'Booked',
  COMPLETED = 'Completed',
}

// --- Security & Workflow Types ---
export interface ApprovalLog {
    id: string;
    approverId: string;
    approverName: string;
    role: string;
    action: 'APPROVED' | 'REJECTED' | 'SENT_BACK';
    timestamp: string;
    comments?: string;
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

export interface BrandingConfig {
    appName: string;
    logoUrl?: string; // If empty, use default C icon
    primaryColor: string; // Hex Code e.g. #0f172a
    sidebarColor: string;
}

export interface DashboardConfig {
    showStats: boolean;
    showRecentRequests: boolean;
    showPendingApprovals: boolean;
    showCalendarWidget: false;
}

export interface DocumentTemplateConfig {
    headerText: string;
    footerText: string;
    showLogo: boolean;
}

// --- 2. Dynamic Form Builder ---
export interface FormField {
    id: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'file';
    required: boolean;
    conditional?: {
        fieldId: string;
        value: string;
    }; // Show only if other field matches value
    options?: string[]; // For dropdown
    validation?: {
        min?: number;
        max?: number;
        regex?: string;
    };
    order: number;
    active: boolean;
}

// --- 3. Workflow & Approval ---
export interface WorkflowStep {
    id: string;
    name: string;
    approverRole: UserRole | 'LineManager' | 'DepartmentHead' | 'CFO' | 'HR';
    condition?: {
        field: 'totalCost' | 'travelType' | 'destinationZone';
        operator: '>' | '<' | '==' | 'IN';
        value: any;
    };
    slaHours: number;
}

// --- 6. Notification Templates ---
export interface NotificationTemplate {
    id: string;
    event: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'QUOTATION' | 'ADVANCE_CLEARANCE';
    channel: 'EMAIL' | 'LINE' | 'SMS';
    subject?: string;
    body: string; // Supports {{name}}, {{id}} variables
    active: boolean;
}

// --- 9. Feature Toggle ---
export interface FeatureToggle {
    id: string;
    name: string;
    key: string;
    enabled: boolean;
    description?: string;
}

// --- 8. Audit Log ---
export interface AuditLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    module: string;
    details: string;
}

// --- NEW: ADVANCED POLICY MODULES ---

// 1. Zones & Per Diem
export interface Zone {
    id: string;
    name: string; // e.g. "Zone A (ASEAN)"
    countries: string[]; // ["Thailand", "Vietnam"]
    currency: string;
    perDiem: number;
}

// 2. Expense Categories
export interface ExpenseCategory {
    id: string;
    name: string; // e.g. "Airfare", "Taxi"
    requiresReceipt: boolean;
    dailyLimit?: number;
    allowCashAdvance: boolean;
    active: boolean;
}

// 3. Cash Advance
export interface CashAdvancePolicy {
    maxPercentage: number; // e.g. 80%
    clearanceDays: number; // e.g. 7 days
}

// 4. Budget Control
export interface BudgetRule {
    id: string;
    scope: 'DEPARTMENT' | 'PROJECT';
    targetId: string; // Dept Code or Project Code
    amount: number;
    period: 'YEARLY' | 'PROJECT_LIFETIME';
    alertThreshold: number; // % e.g. 90
    spent: number; // Current spend
}

export interface SystemSettings {
  // apiProvider: ApiProvider; // Removed in favor of featureMapping
  featureMapping: Record<AppFeature, ApiProvider>; // NEW: Map specific features to providers
  latencySimulation: number; // ms to delay mock response
  apiConfigs: ApiConfig;
  databaseProvider: DatabaseProvider;
  databaseConfig: DatabaseConfig;
  
  // NEW: UI & Maintenance
  branding: BrandingConfig;
  dashboardConfig: DashboardConfig;
  docTemplates: DocumentTemplateConfig;

  // Enterprise Configs (New)
  dynamicForms?: FormField[];
  workflows?: WorkflowStep[];
  notificationTemplates?: NotificationTemplate[];
  featureToggles?: FeatureToggle[];
  systemParams?: {
      taxRate: number;
      currency: string;
      dateFormat: string;
      runningNumberPrefix: string;
  };
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

// --- COMPLEX POLICY & DOA MATRIX INTERFACES (NEW) ---

export interface CompanyProfile {
    id: string; // e.g., "CDG", "CDGS", "CDT"
    name: string;
    taxId?: string;
}

// Generic Condition for any rule
export interface PolicyCondition {
    field: 'JOB_GRADE' | 'COST' | 'TRAVEL_TYPE' | 'DURATION_HOURS' | 'DESTINATION_REGION';
    operator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'IN_LIST' | 'BETWEEN';
    value: any; // 10, [10,11], "INTERNATIONAL", etc.
}

// 1. Complex Flight/Hotel Rules (Matrix)
export interface ComplexRule {
    id: string;
    companyId: string; // Multi-company support
    category: 'FLIGHT_CLASS' | 'HOTEL_LIMIT' | 'PER_DIEM';
    
    // Conditions (AND logic)
    minJobGrade?: number;
    maxJobGrade?: number;
    travelType?: 'DOMESTIC' | 'INTERNATIONAL' | 'ALL';
    minDurationHours?: number; // Only for flight
    
    // Result
    allowedValue: string | number; // "Business", 2000 (Limit)
    currency?: string;
}

// 2. DOA Matrix (Approval Flow)
export interface DOARule {
    id: string;
    companyId: string;
    priority: number; // 1 check first
    
    // Conditions
    minCost: number;
    maxCost: number; // -1 for Infinity
    travelType?: 'DOMESTIC' | 'INTERNATIONAL' | 'ALL';
    department?: string; // Optional: Specific dept logic
    
    // Result: Ordered list of approver roles
    approverChain: string[]; // ["Line Manager", "VP", "CEO"]
}

// --- Policy Configuration Interface ---
export interface TravelPolicy {
  companies: CompanyProfile[];
  
  // Matrix Rules
  complexRules: ComplexRule[];
  doaMatrix: DOARule[];

  // Advanced Modules
  zones: Zone[];
  expenseCategories: ExpenseCategory[];
  cashAdvance: CashAdvancePolicy;
  budgetRules: BudgetRule[];

  // Legacy fields (kept for backward compatibility or simple defaults)
  defaultHotelLimit: {
    domestic: number;
    international: number;
  };
  mileageRate: number; // THB per KM
}

// --- Service Interfaces ---
export type ServiceType = 'FLIGHT' | 'HOTEL' | 'CAR' | 'INSURANCE' | 'EVENT' | 'TRAIN' | 'BUS';

export interface ServiceBase {
  id: string;
  type: ServiceType;
  
  // Costing
  actualCost?: number; // Total (Net)
  costExclVat?: number; // NEW: Price Before VAT
  vatAmount?: number; // NEW: VAT Amount
  
  // Assignment
  assignedTravelerIds?: string[]; // NEW: Specific IDs, if empty = ALL
  
  bookingReference?: string; // PNR or Reservation #
  cancellationPolicy?: string; // NEW
}

export interface FlightService extends ServiceBase {
  type: 'FLIGHT';
  tripType: 'ONE_WAY' | 'ROUND_TRIP';
  from: string; // IATA Code or City
  to: string;   // IATA Code or City
  departureDate: string;
  departureTimeSlot?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  
  // Updated: Explicit preferred times for Employee Request
  preferredDepartureTime?: string; 
  preferredArrivalTime?: string;

  exactDepartureTime?: string; // Actual time (ADS/Booking)
  exactArrivalTime?: string; // NEW: Actual Arrival time (ADS/Booking)
  returnDate?: string;
  returnTimeSlot?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  
  preferredReturnTime?: string; // NEW: For Employee
  exactReturnTime?: string; // Actual time (ADS/Booking)
  
  flightClass: 'Economy' | 'Premium Economy' | 'Business' | 'First';
  airlinePreference?: string;
  flightNumber?: string; // Actual Flight
  frequentFlyerNumber?: string;
  durationHours?: number; // Added for Policy Check (Rule 1.2.2)
  
  // NEW: Baggage & Meal
  needExtraBaggage?: boolean; // NEW: Checkbox for low cost
  baggageWeight?: number; // kg
  mealIncluded?: boolean;

  // NEW: ADS Detailed Fields
  ticketNumber?: string; 
  seatNumber?: string;
  fareRules?: string; // e.g. "Non-Refundable", "Change 2000 THB"
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
  roomCount?: number; // NEW
  breakfastIncluded: boolean;
  specialRequests?: string;

  // NEW: ADS Detailed Fields
  confirmationNumber?: string;
  bedType?: 'Single' | 'Double' | 'Twin' | 'King';
}

export interface CarService extends ServiceBase {
  type: 'CAR';
  pickupLocation: string;
  dropoffLocation: string; // Can be different
  pickupDate: string;
  pickupTime: string;
  dropoffDate: string;
  dropoffTime: string;
  carType: 'Eco' | 'Sedan' | 'SUV' | 'Van' | 'Luxury' | 'Personal Car (Mileage)';
  driverIncluded: boolean;
  mileageDistance?: number; // For Personal Car mileage claim (Rule 2.2.2)
  vendor?: string; // NEW: Rental Company

  // NEW: ADS Detailed Fields
  driverName?: string;
  driverContact?: string;
  vehicleDetails?: string; // License Plate
  exactPickupTime?: string; // NEW: Confirmed ISO DateTime
  exactDropoffTime?: string; // NEW: Confirmed ISO DateTime
}

export interface InsuranceService extends ServiceBase {
  type: 'INSURANCE';
  coverageType: 'Basic' | 'Comprehensive' | 'Worldwide';
  startDate: string;
  endDate: string;
  notes?: string;
  policyNumber?: string;
  
  // NEW: Requested Specific Fields
  plan?: string; // Hip Hop, Boogie, etc.
  beneficiary?: string; // Name & Relationship
}

export interface EventService extends ServiceBase {
  type: 'EVENT';
  eventName: string;
  location: string;
  date: string;
  ticketType: string;
  notes?: string;
}

export interface TrainService extends ServiceBase {
  type: 'TRAIN';
  from: string;
  to: string;
  departureDate: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  trainNumber?: string;
  class?: string; // e.g., 1st Class, Sleeper
  ticketType?: string;
  
  exactDepartureTime?: string; // NEW
  exactArrivalTime?: string; // NEW
}

export interface BusService extends ServiceBase {
  type: 'BUS';
  from: string;
  to: string;
  departureDate: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  company?: string;
  class?: string; // e.g., VIP 24
  seatNumber?: string;
  
  exactDepartureTime?: string; // NEW
  exactArrivalTime?: string; // NEW
}

export type TravelServiceItem = FlightService | HotelService | CarService | InsuranceService | EventService | TrainService | BusService;

// --- Quotation Options (New) ---
export interface QuotationOption {
    id: string;
    name: string; // e.g. "Option 1: Thai Airways", "Option 2: Emirates"
    quoteRef?: string; // Vendor Quote Reference ID
    validUntil?: string; // Quote Validity
    totalAmount: number;
    services: TravelServiceItem[]; // Detailed services for this specific option
    isSelected: boolean;
    remark?: string;
}

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
  companyId?: string; // NEW: To link with Multi-Company Policy
  mobile?: string;
  dateOfBirth?: string; // Required for flights
  passportNumber?: string; // For International
  passportExpiry?: string;
  nationalId?: string; // For Domestic Flights (sometimes required)
  address?: string; // NEW: For Insurance
  
  // Added for Policy Logic
  jobGrade?: number; // e.g., 10, 13
  position?: 'MD' | 'GM' | 'AMD' | 'AGM' | 'Manager' | 'Staff' | 'President' | 'CEO' | 'ADS' | 'Admin' | 'Other';
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
  billableTo?: string; // NEW: Matches paper form "Budget to be reclaimed from"
}

export interface TravelRequest {
  id: string;
  requesterId: string; // Who created the request
  requesterName: string;
  
  requestFor: RequestFor; // Who is it for?
  travelType: TravelType;
  
  travelers: TravelerDetails[]; // List of all people traveling
  
  trip: TripSummary; // High level summary
  services: TravelServiceItem[]; // Detailed bookings (The FINAL Selected ones)
  
  status: RequestStatus;
  
  // Financials
  estimatedCost: number; // Initial guess by Employee
  actualCost?: number;   // Updated by ADS from Vendor
  
  // ADS Workflow
  vendorQuotationSentAt?: string;
  vendorQuotationReceivedAt?: string;
  sentToAgencies?: string[]; // IDs of agencies emailed
  quotations?: QuotationOption[]; // NEW: List of options from vendors
  
  submittedAt?: string;
  
  // SLA Tracking
  slaDeadline?: string; // Timestamp when ADS must complete the task
  
  policyFlags?: string[];
  policyExceptionReason?: string; // If ADS overrides policy

  // --- Workflow & Security ---
  approvalHistory?: ApprovalLog[]; // Immutable audit trail of approvals
  currentApproverRole?: string; // 'Line Manager', 'Department Head', 'CFO'
  requiredApprovalChain?: string[]; // Snapshotted chain required for this request
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
