import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as apiFirstRun from "@/api/firstRun";

const FIRST_RUN_QUERY_KEY = ["firstRun", "status"];

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export function useFirstRunStatus() {
  const queryClient = useQueryClient();
  const tauri = isTauri();

  const statusQuery = useQuery({
    queryKey: FIRST_RUN_QUERY_KEY,
    queryFn: apiFirstRun.getFirstRunStatus,
    enabled: tauri,
  });

  const setCompletedMutation = useMutation({
    mutationFn: apiFirstRun.setFirstRunCompleted,
    onSuccess: () => {
      queryClient.setQueryData(FIRST_RUN_QUERY_KEY, { completed: true });
      queryClient.invalidateQueries({ queryKey: FIRST_RUN_QUERY_KEY });
    },
  });

  return {
    completed: statusQuery.data?.completed ?? null,
    isLoading: statusQuery.isLoading,
    setCompleted: () => setCompletedMutation.mutateAsync(),
    setCompletedIsPending: setCompletedMutation.isPending,
    refetch: () => statusQuery.refetch(),
  };
}
