import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { AuthUser } from "@/types/parking";

const SESSION_QUERY_KEY = ["auth", "session"];

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export function useSession() {
  const queryClient = useQueryClient();
  const tauri = isTauri();

  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async (): Promise<AuthUser | null> => {
      const user = await invoke<AuthUser | null>("auth_get_session");
      return user ?? null;
    },
    enabled: tauri,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const user = await invoke<AuthUser>("auth_login", { username, password });
      return user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await invoke("auth_logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });

  const login = (username: string, password: string) =>
    loginMutation.mutateAsync({ username, password });

  const logout = () => logoutMutation.mutateAsync();

  return {
    user: sessionQuery.data ?? null,
    isLoading: sessionQuery.isLoading,
    isAuthenticated: !!sessionQuery.data,
    login,
    logout,
    loginError: loginMutation.error,
    loginIsPending: loginMutation.isPending,
    logoutIsPending: logoutMutation.isPending,
    refetchSession: () => sessionQuery.refetch(),
  };
}
