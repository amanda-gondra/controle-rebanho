// O endereço do nosso backend. Em produção, defina VITE_API_URL no .env
// (ver .env.example); em desenvolvimento, cai no localhost por padrão.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

// Erro padronizado que as telas recebem quando a API responde com falha.
export type ApiError = {
  status: number;
  code?: string; // código estável do erro (ex.: DUPLICATE_TAG)
  message: string;
  errors?: { field: string; error: string }[];
};

// Avisado quando a sessão some no meio do uso (expirou ou saiu em outra aba).
// O AuthProvider escuta e manda a pessoa para a tela de entrar.
export const SESSION_LOST_EVENT = "rebanho:session-lost";

// Ajudante central: faz a chamada à API e trata a resposta de forma padronizada.
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Só manda o cabeçalho de JSON quando existe um corpo (evita erro no DELETE).
  const headers: Record<string, string> = {};
  if (options?.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    // Manda o cookie de sessão junto (o login fica num cookie HttpOnly,
    // que o JavaScript da página não consegue ler — mais seguro).
    credentials: "include",
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error: ApiError = {
      status: response.status,
      code: body?.code,
      message: body?.message ?? "Algo deu errado.",
      errors: body?.errors,
    };

    // Sessão perdida numa tela já aberta → avisa o app (exceto nas rotas de
    // conta, onde o 401 é a resposta normal de "senha errada"/"não logado").
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT, { detail: error.code }));
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
