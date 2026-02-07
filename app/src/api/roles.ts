import { invokeTauri } from "@/lib/tauriInvoke";
import type { AuthUser, Role } from "@/types/parking";

export function getMyPermissions(): Promise<string[]> {
  return invokeTauri<string[]>("roles_get_my_permissions");
}

export function listUsers(): Promise<AuthUser[]> {
  return invokeTauri<AuthUser[]>("roles_list_users");
}

export function listRoles(): Promise<Role[]> {
  return invokeTauri<Role[]>("roles_list_roles");
}

export function getRolePermissions(roleId: string): Promise<string[]> {
  return invokeTauri<string[]>("roles_get_role_permissions", { roleId });
}

export function listAllPermissions(): Promise<string[]> {
  return invokeTauri<string[]>("roles_list_all_permissions");
}

export function createUser(args: {
  username: string;
  password: string;
  displayName: string;
  roleId: string;
}): Promise<AuthUser> {
  return invokeTauri<AuthUser>("roles_create_user", args);
}

export function updateUser(args: {
  userId: string;
  displayName?: string;
  roleId?: string;
}): Promise<AuthUser> {
  return invokeTauri<AuthUser>("roles_update_user", args);
}

export function deleteUser(userId: string): Promise<void> {
  return invokeTauri("roles_delete_user", { userId });
}

export function setPassword(args: {
  userId: string;
  newPassword: string;
}): Promise<void> {
  return invokeTauri("roles_set_password", args);
}

export function updateRolePermissions(args: {
  roleId: string;
  permissions: string[];
}): Promise<void> {
  return invokeTauri("roles_update_role_permissions", args);
}
