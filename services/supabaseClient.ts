
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storageService } from './storage';

let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

// Check for Environment Variables (Supports Vite, Next.js, CRA patterns)
const ENV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const ENV_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const getSupabase = (): SupabaseClient | null => {
  const settings = storageService.getSettings();
  
  // 1. Try Settings (User Configured via UI)
  // 2. Try Environment Variables (Build Configured)
  const supabaseUrl = settings.databaseConfig.supabaseUrl || ENV_URL;
  const supabaseKey = settings.databaseConfig.supabaseKey || ENV_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  // Re-initialize if config changes
  if (supabaseInstance && lastUrl === supabaseUrl && lastKey === supabaseKey) {
      return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
    lastUrl = supabaseUrl;
    lastKey = supabaseKey;
    return supabaseInstance;
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    return null;
  }
};

export const testSupabaseConnection = async (url: string, key: string) => {
  if (!url || !key) return { success: false, message: "URL or Key is missing" };
  
  try {
    const tempClient = createClient(url, key);
    // Try to get session to verify connectivity
    const { error } = await tempClient.auth.getSession();
    
    if (error) {
        // Some errors imply connection worked but auth failed, which is fine for 'connectivity check'
        return { success: false, message: error.message };
    }
    return { success: true, message: "Connection Successful!" };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
};
