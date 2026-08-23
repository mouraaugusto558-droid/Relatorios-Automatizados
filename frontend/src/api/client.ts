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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);

  if (!response.ok) {
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
