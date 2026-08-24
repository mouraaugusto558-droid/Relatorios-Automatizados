import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet, apiPost, onUnauthorized } from "../api/client";

interface AuthContextType {
  isAuthenticated: boolean | null;
  isLoggingIn: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const { authenticated } = await apiGet<{ authenticated: boolean }>("/api/auth/me");
      setIsAuthenticated(authenticated);
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
    return onUnauthorized(() => setIsAuthenticated(false));
  }, [checkSession]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setIsLoggingIn(true);
    try {
      await apiPost("/api/auth/login", { username, password });
      setIsAuthenticated(true);
      return true;
    } catch {
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiPost("/api/auth/logout");
    } finally {
      setIsAuthenticated(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoggingIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
