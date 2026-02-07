import { invokeTauri } from "@/lib/tauriInvoke";

export type FirstRunStatus = {
  completed: boolean;
};

export function getFirstRunStatus(): Promise<FirstRunStatus> {
  return invokeTauri<FirstRunStatus>("first_run_get_status");
}

export function setFirstRunCompleted(): Promise<void> {
  return invokeTauri("first_run_set_completed");
}
