import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface BackendUser {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  isAdmin?: boolean;
  role?: string;
  walletBalance?: number;
  rewardPoints?: number;
}

interface AuthContextType {
  user: BackendUser | null;
  token: string | null;
  loading: boolean;
  signOut: () => void;
  setAuth: (token: string, user: BackendUser) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  signOut: () => {},
  setAuth: () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async (savedToken?: string): Promise<BackendUser | null> => {
    const t = savedToken || localStorage.getItem("token");
    if (!t) return null;

    try {
      const res = await apiFetch("/api/auth/me");
      if (!res.ok) {
        throw new Error("Failed to fetch user");
      }
      const data = await res.json();
      const u = data.user;
      localStorage.setItem("user", JSON.stringify(u));
      return u;
    } catch (err) {
      console.error("fetchCurrentUser error:", err);
      // Token invalid — clear auth
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return null;
    }
  };

  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem("token");
      if (savedToken) {
        setToken(savedToken);
        const u = await fetchCurrentUser(savedToken);
        if (u) {
          setUser(u);
        } else {
          setToken(null);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const setAuth = (newToken: string, newUser: BackendUser) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const u = await fetchCurrentUser();
    if (u) {
      setUser(u);
    } else {
      signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signOut, setAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
