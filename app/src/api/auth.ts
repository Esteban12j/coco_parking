import { invokeTauri } from "@/lib/tauriInvoke";
import type { AuthUser } from "@/types/parking";

export function getSession(): Promise<AuthUser | null> {
  return invokeTauri<AuthUser | null>("auth_get_session");
}

export function login(username: string, password: string): Promise<AuthUser> {
  return invokeTauri<AuthUser>("auth_login", { username, password });
}

export function logout(): Promise<void> {
  return invokeTauri("auth_logout");
}
