// Replit Auth client hook from javascript_log_in_with_replit blueprint
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", {
        credentials: "include",
      });
      
      // Return null if unauthorized instead of throwing
      if (res.status === 401) {
        return null;
      }
      
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      
      return await res.json();
    },
    retry: false,
    // No staleTime - refetch immediately when invalidated (e.g., after profile picture upload)
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}