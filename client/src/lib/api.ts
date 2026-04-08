/**
 * ============================================================================
 * ARAS COMMAND CENTER - API HELPER
 * ============================================================================
 * Centralized fetch wrapper with credentials, error handling, and types.
 * USE THIS instead of raw fetch() for all internal/admin API calls.
 * ============================================================================
 */

export interface ApiError {
  status: number;
  message: string;
  url: string;
  body?: unknown;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
  ok: boolean;
}

/**
 * Check if status code indicates unauthorized access
 */
export function isUnauthorized(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Check if status code indicates session expired (401)
 */
export function isSessionExpired(status: number): boolean {
  return status === 401;
}

/**
 * Check if status code indicates access denied (403)
 */
export function isAccessDenied(status: number): boolean {
  return status === 403;
}

/**
 * Parse response body safely (JSON or text fallback)
 */
async function parseResponse<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  
  // For non-JSON responses, return text wrapped in object
  try {
    const text = await res.text();
    return { message: text } as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Create a structured API error
 */
function createError(status: number, message: string, url: string, body?: unknown): ApiError {
  return { status, message, url, body };
}

/**
 * Core fetch wrapper with credentials and error handling
 */
async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
      },
    });

    const data = await parseResponse<T>(res);

    if (!res.ok) {
      const errorMessage = 
        (data as any)?.error || 
        (data as any)?.message || 
        `HTTP ${res.status}`;
      
      return {
        data: null,
        error: createError(res.status, errorMessage, url, data),
        ok: false,
      };
    }

    return { data, error: null, ok: true };
  } catch (err: any) {
    return {
      data: null,
      error: createError(0, err.message || 'Network error', url),
      ok: false,
    };
  }
}

/**
 * GET request
 */
export async function apiGet<T = unknown>(url: string): Promise<ApiResult<T>> {
  return apiFetch<T>(url, { method: 'GET' });
}

/**
 * POST request with JSON body
 */
export async function apiPost<T = unknown>(
  url: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request with JSON body
 */
export async function apiPut<T = unknown>(
  url: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'PUT',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request with JSON body
 */
export async function apiPatch<T = unknown>(
  url: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'PATCH',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T = unknown>(url: string): Promise<ApiResult<T>> {
  return apiFetch<T>(url, { method: 'DELETE' });
}

/**
 * POST with FormData (for file uploads)
 * Note: Do NOT set Content-Type header - browser sets it with boundary
 */
export async function apiPostFormData<T = unknown>(
  url: string,
  formData: FormData
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    method: 'POST',
    body: formData,
  });
}

/**
 * Helper to get error title for UI display
 */
export function getErrorTitle(error: ApiError): string {
  if (isSessionExpired(error.status)) {
    return 'Sitzung abgelaufen';
  }
  if (isAccessDenied(error.status)) {
    return 'Zugriff verweigert';
  }
  if (error.status >= 500) {
    return 'Serverfehler';
  }
  if (error.status === 0) {
    return 'Verbindungsfehler';
  }
  return 'Fehler';
}

/**
 * Helper to get error description for UI display
 */
export function getErrorDescription(error: ApiError): string {
  if (isSessionExpired(error.status)) {
    return 'Bitte melde dich erneut an.';
  }
  if (isAccessDenied(error.status)) {
    return 'Du hast keine Berechtigung für diese Aktion.';
  }
  if (error.status >= 500) {
    return 'Ein interner Fehler ist aufgetreten. Bitte versuche es später erneut.';
  }
  if (error.status === 0) {
    return 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.';
  }
  return error.message;
}
