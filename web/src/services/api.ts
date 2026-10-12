// O endereço do nosso backend. Em produção, defina VITE_API_URL no .env
// (ver .env.example); em desenvolvimento, cai no localhost por padrão.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

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
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw {
      status: response.status,
      code: body?.code, // código estável do erro (ex.: DUPLICATE_TAG)
      message: body?.message ?? "Algo deu errado.",
      errors: body?.errors,
    };
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}