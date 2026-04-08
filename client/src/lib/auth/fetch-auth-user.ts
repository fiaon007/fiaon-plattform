/**
 * Fetch Auth User - Robust auth user fetching with retry logic
 * Handles 401s gracefully without crashing the app
 */

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  industry?: string;
  userRole?: string;
  aiProfile?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FetchAuthResult {
  success: boolean;
  user: AuthUser | null;
  error?: string;
  code?: 'UNAUTHENTICATED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'PARSE_ERROR';
}

const RETRY_DELAYS = [200, 600, 1400]; // Exponential backoff

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch current authenticated user with retry logic
 * Returns a clean result object - never throws
 */
export async function fetchAuthUser(
  maxRetries: number = 3,
  onRetry?: (attempt: number, maxAttempts: number) => void
): Promise<FetchAuthResult> {
  let lastError: string = 'Unknown error';
  let lastCode: FetchAuthResult['code'] = 'NETWORK_ERROR';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      // Handle 401 - Unauthenticated
      if (response.status === 401) {
        lastError = 'Nicht authentifiziert';
        lastCode = 'UNAUTHENTICATED';
        
        // Retry if not last attempt
        if (attempt < maxRetries - 1) {
          onRetry?.(attempt + 1, maxRetries);
          await delay(RETRY_DELAYS[attempt] || 1000);
          continue;
        }
        
        return { success: false, user: null, error: lastError, code: lastCode };
      }

      // Handle server errors (5xx)
      if (response.status >= 500) {
        lastError = 'Server nicht erreichbar';
        lastCode = 'SERVER_ERROR';
        
        if (attempt < maxRetries - 1) {
          onRetry?.(attempt + 1, maxRetries);
          await delay(RETRY_DELAYS[attempt] || 1000);
          continue;
        }
        
        return { success: false, user: null, error: lastError, code: lastCode };
      }

      // Parse JSON response
      let data: unknown;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } catch {
        lastError = 'Ungültige Serverantwort';
        lastCode = 'PARSE_ERROR';
        
        if (attempt < maxRetries - 1) {
          onRetry?.(attempt + 1, maxRetries);
          await delay(RETRY_DELAYS[attempt] || 1000);
          continue;
        }
        
        return { success: false, user: null, error: lastError, code: lastCode };
      }

      // Check for user in response
      if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        
        // Handle { user: ... } wrapper
        if ('user' in obj && obj.user && typeof obj.user === 'object') {
          return { success: true, user: obj.user as AuthUser };
        }
        
        // Handle direct user object with id
        if ('id' in obj && obj.id) {
          return { success: true, user: obj as AuthUser };
        }
      }

      // No valid user found
      return { 
        success: false, 
        user: null, 
        error: 'Keine Benutzerdaten', 
        code: 'UNAUTHENTICATED' 
      };

    } catch (err) {
      // Network error
      lastError = 'Netzwerkfehler';
      lastCode = 'NETWORK_ERROR';
      
      if (attempt < maxRetries - 1) {
        onRetry?.(attempt + 1, maxRetries);
        await delay(RETRY_DELAYS[attempt] || 1000);
        continue;
      }
    }
  }

  return { success: false, user: null, error: lastError, code: lastCode };
}
