"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import * as jose from "jose";

type Modulo = "LACHOCO" | "LP";

type Acceso = {
  modulo: Modulo;
  role: string;
};

type AuthContextType = {
  user: string | null;
  role: string | null;
  accesos: Acceso[];
  hasAccess: (modulo: Modulo) => boolean;
  login: (token: string) => void;
  logout: () => void;
};

interface DecodedToken {
  userId: number;
  role: string;
  accesos?: Acceso[];
  exp?: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [accesos, setAccesos] = useState<Acceso[]>([]);

  const router = useRouter();

  const syncAuthState = () => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decodedToken = jose.decodeJwt(token) as DecodedToken;

        console.log("Decoded Token:", decodedToken);

        setUser(String(decodedToken.userId));
        setRole(decodedToken.role);
        setAccesos(decodedToken.accesos || []);
      } catch (error) {
        console.error("Token inválido", error);
        setUser(null);
        setRole(null);
        setAccesos([]);
      }
    } else {
      setUser(null);
      setRole(null);
      setAccesos([]);
    }
  };

  useEffect(() => {
    syncAuthState();

    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  const hasAccess = (modulo: Modulo) => {
    return accesos.some((acceso) => acceso.modulo === modulo);
  };

  const login = (token: string) => {
    try {
      localStorage.setItem("token", token);

      const decodedToken = jose.decodeJwt(token) as DecodedToken;

      console.log("Decoded Token:", decodedToken);

      setUser(String(decodedToken.userId));
      setRole(decodedToken.role);
      setAccesos(decodedToken.accesos || []);
    } catch (error) {
      console.error("Error al procesar el token:", error);
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setAccesos([]);
    localStorage.removeItem("token");
    router.push("/authlogin");
  };

  return (
    <AuthContext.Provider
      value={{ user, role, accesos, hasAccess, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }

  return context;
};