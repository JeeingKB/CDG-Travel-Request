
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storageService } from './storage';

let supabaseInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const getSupabase = (): SupabaseClient | null => {
  const settings = storageService.getSettings();
  const { supabaseUrl, supabaseKey } = settings.databaseConfig;

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
    // Fetch 1 row from a table we know exists or system check
    const { error } = await tempClient.from('system_settings').select('key').limit(1);
    
    if (error) {
        // PGRST116 means no rows returned but query worked (which is success connection)
        if (error.code === 'PGRST116') return { success: true, message: "Connection Successful (Empty Table)" };
        return { success: false, message: error.message };
    }
    return { success: true, message: "Connection Successful!" };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
};
