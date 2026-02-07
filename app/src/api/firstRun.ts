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

export function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  return invokeTauri("first_run_change_admin_password", {
    currentPassword,
    newPassword,
  });
}

export function resetPasswordWithDev(
  developerPassword: string,
  targetUser: string,
  newPassword: string
): Promise<void> {
  return invokeTauri("reset_password_with_dev", {
    developerPassword,
    targetUser: targetUser.trim(),
    newPassword,
  });
}
