import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/authService.js";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("@otium:user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      localStorage.removeItem("@otium:user");
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("@otium:token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await authService.getMe();
          setUser(profile);
          localStorage.setItem("@otium:user", JSON.stringify(profile));
        } catch (err) {
          if (err.response?.status === 401) {
            setToken(null);
            setUser(null);
            localStorage.removeItem("@otium:token");
            localStorage.removeItem("@otium:user");
          } else if (err.response?.status === 403) {
            // Conta expirada
            setUser((current) => {
              if (!current) return current;
              const updated = { ...current, status: "trial_expirado" };
              localStorage.setItem("@otium:user", JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
      setLoading(false);
    }

    loadUser();

    // Ouvinte para evento disparado pelo interceptor do Axios
    const handleAccountExpired = () => {
      setUser((prev) => (prev ? { ...prev, status: "trial_expirado" } : null));
    };

    window.addEventListener("otium:account_expired", handleAccountExpired);
    return () => window.removeEventListener("otium:account_expired", handleAccountExpired);
  }, [token]);

  const login = async (username, password) => {
    const data = await authService.login({ username, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("@otium:token", data.token);
    localStorage.setItem("@otium:user", JSON.stringify(data.user));
    return data;
  };

  const register = async (username, password, email) => {
    const data = await authService.register({ username, password, email });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("@otium:token", data.token);
    localStorage.setItem("@otium:user", JSON.stringify(data.user));
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("@otium:token");
    localStorage.removeItem("@otium:user");
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const profile = await authService.getMe();
      setUser(profile);
      localStorage.setItem("@otium:user", JSON.stringify(profile));
      return profile;
    } catch (e) {
      console.warn("Falha ao atualizar dados do usuário:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        signed: !!user && !!token,
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isTrialExpired: user?.status === "trial_expirado" || user?.status === "bloqueado",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
}
