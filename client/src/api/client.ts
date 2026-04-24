/** API 기본 fetch 래퍼 */

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      msg = data.error ?? data.message ?? msg
    } catch { /* 무시 */ }
    throw new ApiError(res.status, msg)
  }

  // 204 No Content
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, opts?: RequestInit) =>
    request<T>(path, { method: 'GET', ...opts }),
  post: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  patch: <T>(path: string, body?: unknown, opts?: RequestInit) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: <T>(path: string, opts?: RequestInit) =>
    request<T>(path, { method: 'DELETE', ...opts }),
}
