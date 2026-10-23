export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

const BASE = '/api/v1'

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                 ...init.headers },
    })
  } catch {
    throw new ApiError(0, 'network', 'No hay conexión; revisa tu red')
  }
  if (response.status === 204) return undefined as T
  let body: unknown = undefined
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  if (!response.ok) {
    const err = (body ?? {}) as { code?: string; message?: string; details?: Record<string, unknown> }
    throw new ApiError(response.status, err.code ?? `http_${response.status}`,
                       err.message ?? 'Algo salió mal; intenta de nuevo', err.details ?? {})
  }
  return body as T
}
