
import { TravelRequest, Project, CostCenter, TravelPolicy, SystemSettings, Agency, TravelerDetails } from '../types';
import { getSupabase } from './supabaseClient';

const STORAGE_KEY = 'cdg-travel-requests';
const SETTINGS_KEY = 'cdg-system-settings';

// Default Settings Structure (Empty, forcing user configuration)
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
  databaseProvider: 'LOCAL_STORAGE', // Default to Local until configured
  databaseConfig: { endpoint: '', apiKey: '', supabaseUrl: '', supabaseKey: '' }
};

// Empty Policy Default (Safe Fallback)
const EMPTY_POLICY: TravelPolicy = {
    flightRules: [],
    hotelTiers: [],
    defaultHotelLimit: { domestic: 0, international: 0 },
    advanceBookingDays: { domestic: 0, international: 0 },
    perDiem: [],
    doa: { departmentHeadThreshold: 0, executiveThreshold: 0 },
    mileageRate: 0
};

export const storageService = {
  // --- System Settings (Local Storage for Bootstrap) ---
  getSettings: (): SystemSettings => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(stored);
  },

  saveSettings: (settings: SystemSettings): void => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  // --- Requests (CRUD) ---
  getRequests: async (): Promise<TravelRequest[]> => {
    const settings = storageService.getSettings();
    
    // 1. Supabase Strategy
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            const { data, error } = await sb.from('travel_requests').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error("Supabase Error (getRequests):", error.message);
                return [];
            }
            // Map JSONB 'request_data' back to TravelRequest object
            return data.map((row: any) => ({
                ...row.request_data,
                id: row.id,
                status: row.status,
                requesterId: row.user_id,
                submittedAt: row.created_at
            }));
        }
    }

    // 2. Local Storage Strategy (Fallback / Dev without DB)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  },

  saveRequest: async (request: TravelRequest): Promise<TravelRequest[]> => {
    const settings = storageService.getSettings();
    
    // 1. Supabase Strategy
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            const payload = {
                id: request.id,
                user_id: request.requesterId,
                status: request.status,
                request_data: request, 
                updated_at: new Date().toISOString()
            };

            const { error } = await sb.from('travel_requests').upsert(payload);
            if (error) {
                console.error("Supabase Error (saveRequest):", error.message);
                throw new Error("Failed to save request to database.");
            }
            return await storageService.getRequests(); // Refresh list
        }
    }

    // 2. Local Storage Strategy
    const requests = await storageService.getRequests(); 
    const existingIndex = requests.findIndex(r => r.id === request.id);
    let newRequests;
    if (existingIndex >= 0) {
      newRequests = [...requests];
      newRequests[existingIndex] = request;
    } else {
      newRequests = [request, ...requests];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRequests));
    return newRequests;
  },

  deleteRequest: async (id: string): Promise<TravelRequest[]> => {
    const settings = storageService.getSettings();

    // 1. Supabase Strategy
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            const { error } = await sb.from('travel_requests').delete().eq('id', id);
            if (error) console.error("Supabase Error (deleteRequest):", error.message);
            return await storageService.getRequests();
        }
    }

    // 2. Local Storage Strategy
    const requests = await storageService.getRequests();
    const newRequests = requests.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRequests));
    return newRequests;
  },

  // --- Master Data (Employees) ---
  getEmployees: async (): Promise<TravelerDetails[]> => {
      const settings = storageService.getSettings();
      // 1. Supabase
      if (settings.databaseProvider === 'SUPABASE') {
          const sb = getSupabase();
          if (sb) {
              const { data, error } = await sb.from('master_employees').select('*');
              if (error) {
                  console.error("Supabase Error (getEmployees):", error.message);
                  return [];
              }
              // Map DB columns to Frontend Type
              return data.map((row: any) => ({
                  id: row.id,
                  name: row.name,
                  email: row.email,
                  department: row.department, // frontend uses 'department', db uses 'department'
                  position: row.position,
                  jobGrade: row.job_grade,
                  mobile: row.mobile,
                  type: 'Employee',
                  title: 'Mr.' // Default, or add column in DB
              }));
          }
      }
      return []; // Return empty if no DB connected (No more Mock Data)
  },

  // --- Master Data (Projects) ---
  getProjects: async (): Promise<Project[]> => {
    const settings = storageService.getSettings();
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            const { data, error } = await sb.from('master_projects').select('*');
            if (error) console.error("Supabase Error (getProjects):", error.message);
            return data || [];
        }
    }
    return [];
  },

  // --- Master Data (Cost Centers) ---
  getCostCenters: async (): Promise<CostCenter[]> => {
    const settings = storageService.getSettings();
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            const { data, error } = await sb.from('master_cost_centers').select('*');
            if (error) console.error("Supabase Error (getCostCenters):", error.message);
            return data || [];
        }
    }
    return [];
  },

  // --- Agencies / Vendors ---
  getAgencies: async (): Promise<Agency[]> => {
     const settings = storageService.getSettings();
     if (settings.databaseProvider === 'SUPABASE') {
         const sb = getSupabase();
         if (sb) {
             const { data, error } = await sb.from('system_settings').select('value').eq('key', 'agencies').single();
             if (error && error.code !== 'PGRST116') console.error("Supabase Error (getAgencies):", error.message);
             if (data?.value) return data.value;
         }
     }
     // Local Storage fallback for Agencies if desired, or return empty
     const stored = localStorage.getItem('cdg-master-agencies');
     return stored ? JSON.parse(stored) : [];
  },

  saveAgencies: async (agencies: Agency[]): Promise<void> => {
      const settings = storageService.getSettings();
      if (settings.databaseProvider === 'SUPABASE') {
          const sb = getSupabase();
          if (sb) {
              await sb.from('system_settings').upsert({ key: 'agencies', value: agencies });
              return;
          }
      }
      localStorage.setItem('cdg-master-agencies', JSON.stringify(agencies));
  },

  // --- Policy ---
  getPolicies: async (): Promise<TravelPolicy> => {
    const settings = storageService.getSettings();
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            const { data, error } = await sb.from('system_settings').select('value').eq('key', 'policy').single();
            if (error && error.code !== 'PGRST116') console.error("Supabase Error (getPolicies):", error.message);
            if (data?.value) return data.value;
        }
    }
    
    // Fallback to local storage or empty
    const stored = localStorage.getItem('cdg-travel-policy');
    return stored ? JSON.parse(stored) : EMPTY_POLICY;
  },

  savePolicies: async (policy: TravelPolicy): Promise<void> => {
    const settings = storageService.getSettings();
    if (settings.databaseProvider === 'SUPABASE') {
        const sb = getSupabase();
        if (sb) {
            await sb.from('system_settings').upsert({ key: 'policy', value: policy });
            return;
        }
    }
    localStorage.setItem('cdg-travel-policy', JSON.stringify(policy));
  },
};
