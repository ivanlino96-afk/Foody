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
  const response = await send(path, init)
  if (response.status === 204) return undefined as T
  return (await response.json().catch(() => undefined)) as T
}

/** Same as request but returns the body as a Blob (images such as the table QR). */
export async function requestBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  return (await send(path, init)).blob()
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      ...init,
      headers: { Accept: 'application/json',
                 ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
                 ...init.headers },
    })
  } catch {
    throw new ApiError(0, 'network', 'No hay conexión; revisa tu red')
  }
  if (!response.ok) {
    const err = ((await response.json().catch(() => undefined)) ?? {}) as
      { code?: string; message?: string; details?: Record<string, unknown> }
    throw new ApiError(response.status, err.code ?? `http_${response.status}`,
                       err.message ?? 'Algo salió mal; intenta de nuevo', err.details ?? {})
  }
  return response
}
