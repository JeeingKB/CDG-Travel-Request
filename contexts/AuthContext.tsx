
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService } from '../services/authService';
import { getSupabase } from '../services/supabaseClient';
import { TravelerDetails, UserRole } from '../types';
import { storageService } from '../services/storage';

interface User {
  id: string;
  email?: string;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  role?: string; // For Mock Role
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  userRole: UserRole; // Derived role
  employeeDetails: TravelerDetails | null; // Mapped employee data
  signInWithAzure: () => Promise<void>;
  signInMock: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeDetails, setEmployeeDetails] = useState<TravelerDetails | null>(null);
  
  // Default to Employee, but logic can upgrade this based on email or metadata
  const [userRole, setUserRole] = useState<UserRole>('Employee');

  const mapUserToEmployee = async (u: User) => {
      // Logic to find employee details from DB based on email
      const employees = await storageService.getEmployees();
      const match = employees.find(e => e.email === u.email);
      
      if (match) {
          setEmployeeDetails(match);
          // Auto-derive role from master data position if not explicitly mocked
          if (match.position === 'President') setUserRole('President');
          else if (match.position === 'Admin') setUserRole('IT_ADMIN'); // Specific for IT Admin mock
          else if (match.department === 'Admin') setUserRole('ADS');
          else if (match.department === 'Management' || match.position.includes('Manager')) setUserRole('Manager');
      } else {
          // Fallback if not found in master data
          setEmployeeDetails({
              id: u.id,
              name: u.user_metadata.full_name || 'Unknown',
              email: u.email,
              type: 'Employee',
              title: 'Mr.',
              department: 'General',
              jobGrade: 10,
              position: 'Staff'
          });
      }

      // Check for Mock Role override (Takes precedence)
      if (u.role) {
          setUserRole(u.role as any);
      }
  };

  useEffect(() => {
    // Initial Load
    const initAuth = async () => {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
          setUser(currentUser);
          await mapUserToEmployee(currentUser);
      }
      setIsLoading(false);
    };
    initAuth();

    // Listener for Supabase Auth Changes
    const supabase = getSupabase();
    if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                setUser(session.user);
                await mapUserToEmployee(session.user);
            } else {
                // Check if we fell back to mock
                const mock = await authService.getCurrentUser();
                if (!mock) setUser(null);
            }
            setIsLoading(false);
        });
        return () => subscription.unsubscribe();
    }
  }, []);

  const signInWithAzure = async () => {
      await authService.signInWithAzure();
  };

  const signInMock = async (role: UserRole) => {
      setIsLoading(true);
      const res = await authService.signInMock(role);
      if (res.data?.user) {
          setUser(res.data.user);
          await mapUserToEmployee(res.data.user);
      }
      setIsLoading(false);
  };

  const signOut = async () => {
      await authService.signOut();
      // Ensure all state is reset to null to trigger App.tsx guard
      setUser(null);
      setEmployeeDetails(null);
      setUserRole('Employee');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, userRole, employeeDetails, signInWithAzure, signInMock, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
