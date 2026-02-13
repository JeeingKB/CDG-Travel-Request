
import { getSupabase } from './supabaseClient';
import { storageService } from './storage';
import { TravelerDetails, UserRole } from '../types';

export const authService = {
  // Sign in with Azure AD (SSO)
  signInWithAzure: async () => {
    const supabase = getSupabase();
    if (!supabase) {
      console.warn("Supabase not configured.");
      return { error: { message: "Supabase is not configured. Please log in via Mock/Demo to configure Settings, or set environment variables." } };
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid offline_access', // Standard Azure scopes
        redirectTo: window.location.origin, // Redirect back to current page
      },
    });

    return { data, error };
  },

  // Mock Login for Demo/Testing (Local Storage Mode)
  // This now simulates logging in as a SPECIFIC PERSON defined in storage.ts (INIT_EMPLOYEES)
  signInMock: async (requestedRole: UserRole) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Define Demo Personas that match INIT_EMPLOYEES in storage.ts
    // The actual Role determination will happen in AuthContext based on the data loaded for these emails.
    let mockUser;
    
    switch (requestedRole) {
        case 'ADS':
            // Corresponds to ADS001
            mockUser = { id: 'ADS001', email: 'admin@cdg.co.th', user_metadata: { full_name: 'Admin Support', avatar_url: `https://ui-avatars.com/api/?name=Admin+Support&background=random` } };
            break;
        case 'Manager':
            // Corresponds to MGR001
            mockUser = { id: 'MGR001', email: 'manager@cdg.co.th', user_metadata: { full_name: 'John Manager', avatar_url: `https://ui-avatars.com/api/?name=John+Manager&background=random` } };
            break;
        case 'President':
            // Corresponds to PRE001
            mockUser = { id: 'PRE001', email: 'president@cdg.co.th', user_metadata: { full_name: 'David President', avatar_url: `https://ui-avatars.com/api/?name=David+President&background=random` } };
            break;
        case 'IT_ADMIN':
            // Corresponds to IT001
            mockUser = { id: 'IT001', email: 'it.admin@cdg.co.th', user_metadata: { full_name: 'Tech Admin', avatar_url: `https://ui-avatars.com/api/?name=Tech+Admin&background=random` } };
            break;
        case 'Employee':
        default:
             // Corresponds to EMP001
             mockUser = { id: 'EMP001', email: 'alex.b@cdg.co.th', user_metadata: { full_name: 'Alex Bennett', avatar_url: `https://ui-avatars.com/api/?name=Alex+Bennett&background=random` } };
            break;
    }
    
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
