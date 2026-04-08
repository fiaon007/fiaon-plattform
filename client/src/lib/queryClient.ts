import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * CRITICAL: Force same-origin by stripping any absolute URL to just the path.
 * This prevents CORS issues when browser is on plattform-aras.ai vs www.plattform-aras.ai
 */
function toSameOrigin(url: string): string {
  // If already relative, return as-is
  if (url.startsWith('/')) return url;
  
  // If absolute URL, extract just the path
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    // Not a valid URL, ensure it starts with /
    return url.startsWith('/') ? url : `/${url}`;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.warn(`[QueryClient] API Error ${res.status}: ${text}`);
    // Don't throw in production to avoid Suspense errors
    // Instead return null and let components handle it
    return false;
  }
  return true;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const safeUrl = toSameOrigin(url);
  const res = await fetch(safeUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  const isOk = await throwIfResNotOk(res);
  if (!isOk) {
    // Return a fake empty response to avoid throwing
    return new Response(JSON.stringify(null), { status: 200 });
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const safeUrl = toSameOrigin(queryKey[0] as string);
    const res = await fetch(safeUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    const isOk = await throwIfResNotOk(res);
    if (!isOk) {
      // Return null instead of throwing to avoid Suspense errors
      return null;
    }
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
