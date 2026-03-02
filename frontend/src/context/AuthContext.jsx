// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getUser, clearAuth } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const navigate = useNavigate();

  // 🔒 Deslogueo reactivo si otro tab o el http() limpian el auth
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "le_auth_token" && !e.newValue) {
        setUser(null);
        navigate("/login", { replace: true });
      }
    };
    const onAuthCleared = () => {
      setUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("auth:cleared", onAuthCleared);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth:cleared", onAuthCleared);
    };
  }, [navigate]);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    const u = res?.user || null;
    if (!u) throw new Error("Respuesta de login inválida (falta usuario).");
    setUser(u);
    navigate(u.rol === "E" ? "/encargado" : "/operario", { replace: true });
  };

  const logout = async () => {
    try { await api.logout(); } finally {
      clearAuth();
      setUser(null);
      navigate("/login", { replace: true });
      // Emití evento para tabs actuales (y misma pestaña cuando http() lo use)
      window.dispatchEvent(new Event("auth:cleared"));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLogged: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);







