
import { getSupabase } from './supabaseClient';
import { storageService } from './storage';
import { TravelerDetails } from '../types';

export const authService = {
  // Sign in with Azure AD (SSO)
  signInWithAzure: async () => {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("Supabase not configured. Using Mock Logic.");
      return { error: { message: "Supabase URL/Key missing in settings." } };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile',
        redirectTo: window.location.origin, // Redirect back to current page
      },
    });

    return { data, error };
  },

  // Mock Login for Demo/Testing (Local Storage Mode)
  signInMock: async (role: 'Employee' | 'Manager' | 'ADS') => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Create a fake user session object
    const mockUser = {
      id: role === 'ADS' ? 'ADS001' : role === 'Manager' ? 'MGR001' : 'EMP001',
      email: `${role.toLowerCase()}@cdg.co.th`,
      role: role,
      user_metadata: {
        full_name: role === 'Employee' ? 'Alex Bennett' : role === 'Manager' ? 'Sarah Connor' : 'Admin User',
        avatar_url: `https://ui-avatars.com/api/?name=${role}&background=random`
      }
    };
    
    // Store in Session Storage to persist during refresh (simulating session)
    sessionStorage.setItem('cdg-mock-session', JSON.stringify(mockUser));
    return { data: { user: mockUser }, error: null };
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem('cdg-mock-session');
    window.location.reload(); // Force refresh to clear state
  },

  getCurrentUser: async () => {
    const supabase = getSupabase();
    
    // 1. Check Supabase Session
    if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) return data.session.user;
    }

    // 2. Check Mock Session
    const mockSession = sessionStorage.getItem('cdg-mock-session');
    if (mockSession) {
        return JSON.parse(mockSession);
    }

    return null;
  }
};
