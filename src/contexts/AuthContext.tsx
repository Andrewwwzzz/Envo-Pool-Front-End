import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface BackendUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  isVerified: boolean;
  isAdmin?: boolean;
  isMaster?: boolean;
  role?: string;
  staffPermissions?: string[];
  walletBalance?: number;
  totalSpent?: number;
  rewardPoints?: number;
  shortId?: string;
  username?: string;
  phone?: string;
  isPhoneVerified?: boolean;
  showName?: boolean;
  dateOfBirth?: string;
  createdAt?: string;
  kyc?: {
    verified?: boolean;
    name?: string;
    dob?: string;
    mobile?: string;
    source?: string;
    verifiedAt?: string;
  };
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
      // Derive isAdmin from role (admin or staff can access admin dashboard)
      u.isAdmin = u.role === "admin" || u.role === "staff";
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
    newUser.isAdmin = newUser.role === "admin" || newUser.role === "staff";
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // Clear all cached query data
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("cache:")) localStorage.removeItem(key);
    });
    setToken(null);
    setUser(null);
  };

  // Inactivity timeout — sign user out after 30 minutes of no activity
  const lastActivityRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!token) return;
    const TIMEOUT_MS = 30 * 60 * 1000;
    lastActivityRef.current = Date.now();
    const onActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ["mousemove", "keydown", "click", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > TIMEOUT_MS) {
        toast("You have been signed out due to inactivity");
        signOut();
      }
    }, 60 * 1000);
    return () => {
      clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [token]);

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
