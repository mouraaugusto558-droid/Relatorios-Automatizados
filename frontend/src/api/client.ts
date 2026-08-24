/**
 * Client HTTP mínimo para o frontend: um wrapper fino sobre `fetch` que
 * centraliza a checagem de `res.ok` e o parse de JSON, evitando repetir
 * esse bloco em cada hook/handler. Sem retry, cache ou interceptors — YAGNI.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Base da API quando front e back ficam em domínios diferentes (Vercel +
 * EasyPanel). Vazia em dev/same-origin (comportamento atual, caminho
 * relativo) — só definida no build feito para a Vercel. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Registra um callback disparado toda vez que uma chamada à API devolver
 * 401 (sessão ausente/expirada) — usado pelo `AuthContext` pra jogar o
 * usuário de volta pra tela de login sem cada hook precisar tratar isso. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: "include" });

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    const method = init?.method ?? "GET";
    throw new ApiError(`API ${method} ${path} falhou (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}
