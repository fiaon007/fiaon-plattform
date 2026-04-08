import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      console.log('[FRONTEND-DEBUG] Login attempt:', credentials.username);
      // Use fetch directly — apiRequest swallows non-2xx and returns fake 200
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Login failed" }));
        console.log('[FRONTEND-DEBUG] Login rejected:', res.status, data);
        const err = new Error(data.message || "Login failed");
        (err as any).code = data.code;
        (err as any).status = res.status;
        throw err;
      }
      const userData = await res.json();
      console.log('[FRONTEND-DEBUG] Login response:', userData);
      return userData;
    },
    onSuccess: (user) => {
      console.log('[FRONTEND-DEBUG] Login success, setting user data:', user);
      queryClient.setQueryData(["/api/auth/user"], user);
    },
    onError: (error) => {
      console.log('[FRONTEND-DEBUG] Login error:', error);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: { 
      username: string; 
      password: string; 
      email?: string; 
      firstName?: string; 
      lastName?: string;
      // 🔥 Business Intelligence Fields
      company?: string;
      website?: string;
      industry?: string;
      role?: string;
      phone?: string;
      language?: string;
      primaryGoal?: string;
    }) => {
      console.log('[FRONTEND-DEBUG] Register attempt:', userData.username);
      // Use fetch directly — apiRequest swallows non-2xx and returns fake 200
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Registration failed" }));
        console.log('[FRONTEND-DEBUG] Register rejected:', res.status, data);
        const err = new Error(data.message || "Registration failed");
        (err as any).status = res.status;
        throw err;
      }
      const newUser = await res.json();
      console.log('[FRONTEND-DEBUG] Register response:', newUser);
      return newUser;
    },
    onSuccess: (user) => {
      console.log('[FRONTEND-DEBUG] Registration success, setting user data:', user);
      queryClient.setQueryData(["/api/auth/user"], user);
    },
    onError: (error) => {
      console.log('[FRONTEND-DEBUG] Registration error:', error);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  // If there's an error, consider user as not authenticated and stop loading
  const isAuthenticated = !!user;
  const isActuallyLoading = isLoading && !error;

  return {
    user,
    isLoading: isActuallyLoading,
    isAuthenticated,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}