import React, { createContext, useContext, useEffect, useState } from "react";

interface BackendUser {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  isAdmin?: boolean;
  walletBalance?: number;
  rewardPoints?: number;
}

interface AuthContextType {
  user: BackendUser | null;
  token: string | null;
  loading: boolean;
  signOut: () => void;
  setAuth: (token: string, user: BackendUser) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  signOut: () => {},
  setAuth: () => {},
  refreshUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
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

  const refreshUser = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {}
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signOut, setAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
