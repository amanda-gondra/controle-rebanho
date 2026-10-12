import { request } from "./api.js";

export type Account = {
  user: { id: string; name: string; email: string };
  farm: { id: string; name: string; country: string; timezone: string };
};

export type RegisterInput = {
  farmName: string;
  name: string;
  email: string;
  password: string;
};

export function register(input: RegisterInput) {
  return request<Account>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(email: string, password: string) {
  return request<Account>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request<void>("/auth/logout", { method: "POST" });
}

// Quem está logado (ou erro 401 se ninguém)
export function getMe() {
  return request<Account>("/auth/me");
}
