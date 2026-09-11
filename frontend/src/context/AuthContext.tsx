import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "../types";
import { loginUser, signupUser } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name?: string) => Promise<void>;
  demoLogin: () => void;
  logout: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const DEMO_USER: User = {
  id: "usr_demo_1",
  email: "jane.doe@legalcorp.com",
  name: "Jane Doe",
  role: "Senior Legal Counsel",
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = "counsel_auth_user";
const STORAGE_KEY_TOKEN = "counsel_auth_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : DEMO_USER;
    } catch {
      return DEMO_USER;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || "counsel_demo_token";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  }, [token]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      try {
        const res = await loginUser(email, pass);
        setUser(res.user);
        setToken(res.access_token);
      } catch {
        // Fallback for offline or local testing if backend isn't running or endpoint fails
        const fallbackUser: User = {
          id: `usr_${Date.now()}`,
          email,
          name: email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          role: "Legal Professional",
        };
        setUser(fallbackUser);
        setToken(`counsel_local_tok_${Date.now()}`);
      }
      setIsLoginModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, pass: string, name?: string) => {
    setIsLoading(true);
    try {
      try {
        const res = await signupUser(email, pass, name);
        setUser(res.user);
        setToken(res.access_token);
      } catch {
        const fallbackUser: User = {
          id: `usr_${Date.now()}`,
          email,
          name: name || email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          role: "Legal Professional",
        };
        setUser(fallbackUser);
        setToken(`counsel_local_tok_${Date.now()}`);
      }
      setIsLoginModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = () => {
    setUser(DEMO_USER);
    setToken("counsel_demo_token");
    setIsLoginModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        demoLogin,
        logout,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
