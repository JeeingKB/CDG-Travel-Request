
import { TravelRequest, Project, CostCenter, TravelPolicy, SystemSettings, Agency, TravelerDetails } from '../types';
import { getSupabase } from './supabaseClient';

const STORAGE_KEY = 'cdg-travel-requests';
const SETTINGS_KEY = 'cdg-system-settings';

// Default Settings Structure
const DEFAULT_SETTINGS: SystemSettings = {
  featureMapping: {
      'CHAT': 'GEMINI',
      'OCR': 'GEMINI',
      'JUSTIFICATION': 'GEMINI',
      'POLICY': 'GEMINI',
      'DOC_GEN': 'MOCK'
  },
  latencySimulation: 500,
  apiConfigs: {
    gemini: {
      apiKey: process.env.API_KEY || '',
      model: 'gemini-3-flash-preview'
    },
    openai: { apiKey: '', model: 'gpt-4o' },
    custom: { endpoint: '', apiKey: '', model: '' }
  },
  // Defaulting to LOCAL_STORAGE first to ensure stability for the demo unless explicitly configured otherwise
  databaseProvider: 'LOCAL_STORAGE', 
  databaseConfig: { 
      endpoint: '', 
      apiKey: '', 
      supabaseUrl: '', 
      supabaseKey: '' 
  }
};

// Empty Policy Default
const EMPTY_POLICY: TravelPolicy = {
    flightRules: [],
    hotelTiers: [],
    defaultHotelLimit: { domestic: 2000, international: 5000 },
    advanceBookingDays: { domestic: 7, international: 14 },
    perDiem: [],
    doa: { departmentHeadThreshold: 50000, executiveThreshold: 200000 },
    mileageRate: 5
};

// --- STATIC REFERENCE DATA ---
const STATIC_AIRPORTS = [
  { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok' },
  { code: 'DMK', name: 'Don Mueang Intl', city: 'Bangkok' },
  { code: 'CNX', name: 'Chiang Mai Intl', city: 'Chiang Mai' },
  { code: 'HKT', name: 'Phuket Intl', city: 'Phuket' },
  { code: 'HDY', name: 'Hat Yai Intl', city: 'Hat Yai' },
  { code: 'SIN', name: 'Changi Airport', city: 'Singapore' },
  { code: 'NRT', name: 'Narita Intl', city: 'Tokyo' },
  { code: 'HND', name: 'Haneda Intl', city: 'Tokyo' },
  { code: 'LHR', name: 'Heathrow', city: 'London' },
  { code: 'JFK', name: 'John F. Kennedy', city: 'New York' },
  { code: 'SFO', name: 'San Francisco Intl', city: 'San Francisco' },
];

const STATIC_CITIES = [
  "Bangkok", "Chiang Mai", "Phuket", "Khon Kaen", "Pattaya", "Hat Yai",
  "Singapore", "Tokyo", "London", "New York", "San Francisco", 
  "Seoul", "Hong Kong", "Sydney", "Paris", "Berlin", "Vientiane", "Hanoi"
];

const STATIC_AIRLINES = [
  "Thai Airways", "Bangkok Airways", "AirAsia", "Nok Air", 
  "Singapore Airlines", "Japan Airlines", "ANA", "Emirates", "Qatar Airways"
];

// Helper to safely read localStorage
const safeGetItem = (key: string, defaultVal: any) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultVal;
    } catch (e) {
        console.error(`Error reading ${key} from localStorage`, e);
        return defaultVal;
    }
};

export const storageService = {
  // --- System Settings ---
  getSettings: (): SystemSettings => {
    return safeGetItem(SETTINGS_KEY, DEFAULT_SETTINGS);
  },

  saveSettings: (settings: SystemSettings): void => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  // --- Requests (CRUD) ---
  getRequests: async (): Promise<TravelRequest[]> => {
    const settings = storageService.getSettings();
    
    // Attempt Supabase if configured
    if (settings.databaseProvider === 'SUPABASE' && settings.databaseConfig.supabaseUrl) {
        const sb = getSupabase();
        if (sb) {
            try {
                const { data, error } = await sb.from('travel_requests').select('*').order('created_at', { ascending: false });
                if (!error && data) {
                    return data.map((row: any) => ({
                        ...row.request_data, 
                        id: row.id,
                        status: row.status, 
                        requesterId: row.user_id, 
                        submittedAt: row.created_at
                    }));
                } else {
                    console.warn("Supabase fetch failed, falling back to Local Storage:", error?.message);
                }
            } catch (e) {
                console.warn("Supabase connection error, falling back.");
            }
        }
    }

    // Reliable Fallback to Local Storage
    return safeGetItem(STORAGE_KEY, []);
  },

  saveRequest: async (request: TravelRequest): Promise<TravelRequest[]> => {
    const settings = storageService.getSettings();
    let savedToCloud = false;

    // Try Cloud Save
    if (settings.databaseProvider === 'SUPABASE' && settings.databaseConfig.supabaseUrl) {
        const sb = getSupabase();
        if (sb) {
            try {
                const payload = {
                    id: request.id,
                    user_id: request.requesterId,
                    status: request.status,
                    request_data: request,
                    updated_at: new Date().toISOString()
                };
                const { error } = await sb.from('travel_requests').upsert(payload);
                if (!error) savedToCloud = true;
            } catch (e) {
                console.error("Cloud save failed", e);
            }
        }
    }

    // ALWAYS Save to Local Storage as Backup/Primary
    const requests = await storageService.getRequests(); // This gets current list (from whatever source worked)
    
    // Filter duplicates if any
    const existingIndex = requests.findIndex(r => r.id === request.id);
    let newRequests;
    if (existingIndex >= 0) {
      newRequests = [...requests];
      newRequests[existingIndex] = request;
    } else {
      newRequests = [request, ...requests];
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRequests));
    
    // If cloud save worked, we might want to return fetching from cloud, 
    // but returning local state is faster and safer for UI consistency.
    return newRequests; 
  },

  deleteRequest: async (id: string): Promise<TravelRequest[]> => {
    const settings = storageService.getSettings();

    if (settings.databaseProvider === 'SUPABASE' && settings.databaseConfig.supabaseUrl) {
        const sb = getSupabase();
        if (sb) {
            await sb.from('travel_requests').delete().eq('id', id);
        }
    }

    const requests = safeGetItem(STORAGE_KEY, []);
    const newRequests = requests.filter((r: TravelRequest) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRequests));
    return newRequests;
  },

  // --- Master Data (Employees) ---
  getEmployees: async (): Promise<TravelerDetails[]> => {
      // Fallback Static Data
      return [
        { id: 'EMP001', name: 'Alex Bennett', email: 'alex.b@cdg.co.th', department: 'Sales', position: 'Manager', jobGrade: 13, mobile: '081-111-2222', type: 'Employee', title: 'Mr.' },
        { id: 'EMP002', name: 'Sarah Connor', email: 'sarah.c@cdg.co.th', department: 'IT', position: 'Staff', jobGrade: 10, mobile: '089-999-8888', type: 'Employee', title: 'Ms.' },
        { id: 'ADS001', name: 'Admin Support', email: 'admin@cdg.co.th', department: 'Admin', position: 'Staff', jobGrade: 9, mobile: '02-111-2222', type: 'Employee', title: 'Ms.' },
        { id: 'MGR001', name: 'John Manager', email: 'manager@cdg.co.th', department: 'Management', position: 'GM', jobGrade: 15, mobile: '081-999-9999', type: 'Employee', title: 'Mr.' }
      ];
  },

  // --- Master Data (Projects) ---
  getProjects: async (): Promise<Project[]> => {
    return [
         { code: 'PRJ-2024-001', name: 'Cloud Migration', manager: 'Alex Bennett', budget: 1000000, spent: 250000, status: 'Active' },
         { code: 'PRJ-2024-002', name: 'AI Integration', manager: 'Sarah Connor', budget: 500000, spent: 10000, status: 'Active' },
         { code: 'PRJ-2024-003', name: 'Infra Upgrade', manager: 'John Doe', budget: 2000000, spent: 1500000, status: 'Active' }
    ];
  },

  // --- Master Data (Cost Centers) ---
  getCostCenters: async (): Promise<CostCenter[]> => {
    return [
        { code: 'CC-GEN-001', name: 'General Mgmt', department: 'Management', budget: 5000000, available: 4500000 },
        { code: 'CC-SAL-002', name: 'Sales & Marketing', department: 'Sales', budget: 2000000, available: 1200000 },
        { code: 'CC-IT-003', name: 'IT Infrastructure', department: 'IT', budget: 3000000, available: 200000 }
    ];
  },

  // --- Master Data (Static / Reference) ---
  getAirports: async (): Promise<any[]> => STATIC_AIRPORTS,
  getCities: async (): Promise<string[]> => STATIC_CITIES,
  getAirlines: async (): Promise<string[]> => STATIC_AIRLINES,

  // --- Agencies ---
  getAgencies: async (): Promise<Agency[]> => {
     return safeGetItem('cdg-master-agencies', []);
  },

  saveAgencies: async (agencies: Agency[]): Promise<void> => {
      localStorage.setItem('cdg-master-agencies', JSON.stringify(agencies));
  },

  // --- Policy ---
  getPolicies: async (): Promise<TravelPolicy> => {
    return safeGetItem('cdg-travel-policy', EMPTY_POLICY);
  },

  savePolicies: async (policy: TravelPolicy): Promise<void> => {
    localStorage.setItem('cdg-travel-policy', JSON.stringify(policy));
  },
};
