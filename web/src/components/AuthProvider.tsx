import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { SESSION_LOST_EVENT } from "../services/api.js";
import * as authApi from "../services/auth.js";
import type { Account, RegisterInput } from "../services/auth.js";
import type { Farm } from "../services/farm.js";
import { setDisplayCurrency } from "../types/format.js";

// Estado do login, compartilhado por todo o app.
//  - "loading": ainda perguntando ao servidor se há sessão (ao abrir o app)
//  - account: quem está logado (ou null)
//  - sessionExpired: a sessão caiu no meio do uso → a tela de entrar avisa
type AuthState = {
  loading: boolean;
  account: Account | null;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  // Atualiza a fazenda depois de salvar as configurações (nome no menu, fuso...)
  setFarm: (farm: Farm) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro do AuthProvider.");
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Ao abrir o app: já existe uma sessão válida (cookie)?
  useEffect(() => {
    authApi
      .getMe()
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  // Valores em dinheiro aparecem na moeda da fazenda (D-30: real na 1.0)
  useEffect(() => {
    if (account) setDisplayCurrency(account.farm.currency);
  }, [account]);

  // Se alguma tela recebe 401, a sessão acabou: volta para a tela de entrar.
  useEffect(() => {
    function onSessionLost() {
      setSessionExpired(true);
      setAccount(null);
    }
    window.addEventListener(SESSION_LOST_EVENT, onSessionLost);
    return () => window.removeEventListener(SESSION_LOST_EVENT, onSessionLost);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setSessionExpired(false);
    setAccount(result);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input);
    setSessionExpired(false);
    setAccount(result);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setSessionExpired(false);
      setAccount(null);
    }
  }, []);

  const setFarm = useCallback((farm: Farm) => {
    setAccount((current) => (current ? { ...current, farm } : current));
  }, []);

  return (
    <AuthContext.Provider
      value={{ loading, account, sessionExpired, login, register, logout, setFarm }}
    >
      {children}
    </AuthContext.Provider>
  );
}
