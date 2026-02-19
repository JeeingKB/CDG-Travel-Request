import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  userRole: UserRole; // Derived role
  employeeDetails: TravelerDetails | null; // Mapped employee data
  signInWithAzure: () => Promise<any>;
  signInMock: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minutes

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [employeeDetails, setEmployeeDetails] = useState<TravelerDetails | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Employee');
  
  // Session Timeout Refs
  // Using ReturnType<typeof setTimeout> to handle both Node and Browser environments safely
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (user) {
          idleTimerRef.current = setTimeout(() => {
              console.warn("Session expired due to inactivity.");
              signOut();
              alert("Session expired due to inactivity. Please log in again.");
          }, IDLE_TIMEOUT_MS);
      }
  };

  useEffect(() => {
      // Activity Listeners
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      const handleActivity = () => resetIdleTimer();
      
      events.forEach(e => window.addEventListener(e, handleActivity));
      
      if (user) resetIdleTimer();

      return () => {
          events.forEach(e => window.removeEventListener(e, handleActivity));
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
  }, [user]);

  // Core Logic: Determine Role from Data
  const mapUserToEmployee = async (u: User) => {
      const employees = await storageService.getEmployees();
      // Find employee by email (assuming email is unique and present in master data)
      const match = employees.find(e => e.email === u.email);
      
      if (match) {
          setEmployeeDetails(match);
          
          // --- ROLE DERIVATION LOGIC ---
          // This ensures the role depends on the DATA, not the login button
          if (match.position === 'President' || match.position === 'CEO') {
              setUserRole('President');
          } else if (match.position === 'Admin' && match.department === 'IT') {
              setUserRole('IT_ADMIN');
          } else if (match.department === 'Admin' || match.position === 'ADS') {
              setUserRole('ADS');
          } else if (match.department === 'Management' || (match.position && match.position.includes('Manager')) || match.position === 'GM') {
              setUserRole('Manager');
          } else {
              setUserRole('Employee');
          }
      } else {
          // Fallback for unknown users (e.g. new Azure AD sign-in not in master data)
          // Default to basic Employee
          const newEmp: TravelerDetails = {
              id: u.id,
              name: u.user_metadata.full_name || 'Unknown',
              email: u.email,
              type: 'Employee',
              title: 'Mr.',
              department: 'General',
              jobGrade: 10,
              position: 'Staff'
          };
          setEmployeeDetails(newEmp);
          setUserRole('Employee');
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
      return await authService.signInWithAzure();
  };

  const signInMock = async (roleHint: UserRole) => {
      setIsLoading(true);
      // signInMock now returns the User Object corresponding to that role
      const res = await authService.signInMock(roleHint);
      if (res.data?.user) {
          setUser(res.data.user);
          await mapUserToEmployee(res.data.user);
      }
      setIsLoading(false);
  };

  const signOut = async () => {
      await authService.signOut();
      setUser(null);
      setEmployeeDetails(null);
      setUserRole('Employee');
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
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