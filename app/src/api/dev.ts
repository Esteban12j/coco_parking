import { invokeTauri } from "@/lib/tauriInvoke";

export function getCurrentUserId(): Promise<string> {
  return invokeTauri<string>("dev_get_current_user_id");
}

export function listCommands(): Promise<string[]> {
  return invokeTauri<string[]>("dev_list_commands");
}

export function getDbPath(): Promise<string> {
  return invokeTauri<string>("dev_get_db_path");
}

export function loginAsDeveloper(): Promise<string> {
  return invokeTauri<string>("dev_login_as_developer");
}

export function setCurrentUser(userId: string): Promise<void> {
  return invokeTauri("dev_set_current_user", { userId });
}

export function runCommand(
  command: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return invokeTauri(command, args);
}
