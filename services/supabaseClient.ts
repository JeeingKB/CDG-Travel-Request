
import { createClient } from '@supabase/supabase-js';
import { storageService } from './storage';

let supabaseInstance: any = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const settings = storageService.getSettings();
  const { supabaseUrl, supabaseKey } = settings.databaseConfig;

  if (supabaseUrl && supabaseKey) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey);
      return supabaseInstance;
    } catch (error) {
      console.error("Failed to initialize Supabase:", error);
      return null;
    }
  }
  return null;
};

export const testSupabaseConnection = async (url: string, key: string) => {
  if (!url || !key) return { success: false, message: "URL or Key is missing" };
  
  try {
    const tempClient = createClient(url, key);
    // Try to fetch 1 row from system_settings to verify read access
    const { data, error } = await tempClient.from('system_settings').select('key').limit(1);
    
    if (error) {
        return { success: false, message: error.message };
    }
    return { success: true, message: "Connection Successful!" };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
};
