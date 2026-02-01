import { useQuery } from "@tanstack/react-query";
import { invokeTauri } from "@/lib/tauriInvoke";

const MY_PERMISSIONS_QUERY_KEY = ["auth", "myPermissions"];

export const PERMISSION_DEV_CONSOLE = "dev:console:access";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export function useMyPermissions(enabled = true) {
  const tauri = isTauri();
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: MY_PERMISSIONS_QUERY_KEY,
    queryFn: () => invokeTauri<string[]>("roles_get_my_permissions"),
    enabled: tauri && enabled,
  });

  const hasPermission = (permission: string): boolean =>
    permissions.includes(permission);

  const hasAnyPermission = (prefixOrList: string | string[]): boolean => {
    if (Array.isArray(prefixOrList)) {
      return prefixOrList.some((p) => permissions.includes(p));
    }
    return permissions.some((p) => p.startsWith(prefixOrList));
  };

  return { permissions, isLoading, hasPermission, hasAnyPermission };
}

export const ROUTE_REQUIRED_PERMISSION: Record<string, string> = {
  "/vehicles": "vehiculos:entries:read",
  "/till": "caja:treasury:read",
  "/metrics": "metricas:dashboard:read",
  "/roles": "roles:users:read",
  "/backup": "backup:list:read",
  "/dev-console": "dev:console:access",
};

export function getRequiredPermissionForPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return ROUTE_REQUIRED_PERMISSION[normalized] ?? null;
}
