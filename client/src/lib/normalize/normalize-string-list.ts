/**
 * Normalize String List - Safely converts any input to a string array
 * Prevents .map() crashes from non-array values (critical for v.services bug)
 */

export function normalizeStringList(input: unknown): string[] {
  // Handle array input
  if (Array.isArray(input)) {
    return input
      .filter((x): x is string => typeof x === 'string')
      .map(s => s.trim())
      .filter(Boolean);
  }
  
  // Handle string input - split by common delimiters
  if (typeof input === 'string' && input.trim()) {
    return input
      .split(/[,;\n•\-–\*]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  
  // Return empty array for null, undefined, objects, numbers, etc.
  return [];
}

/**
 * Safe array getter - ensures we always get an array
 * Use this for any field that might be undefined/null/non-array
 */
export function safeArray<T>(input: T[] | null | undefined): T[] {
  return Array.isArray(input) ? input : [];
}

/**
 * Safe string getter - ensures we always get a string
 */
export function safeString(input: unknown): string {
  return typeof input === 'string' ? input : '';
}

/**
 * Safe object getter - ensures we always get an object
 */
export function safeObject<T extends object>(input: T | null | undefined): T {
  return (input && typeof input === 'object') ? input : {} as T;
}
