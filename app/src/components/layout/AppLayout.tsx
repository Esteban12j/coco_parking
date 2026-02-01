import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { useEffect } from "react";
import { Car, DollarSign, BarChart3, Shield, Database, Cloud, Terminal, Languages, HardDrive, Cpu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useParkingStore } from "@/hooks/useParkingStore";
import { useSession } from "@/hooks/useSession";
import {
  useMyPermissions,
  ROUTE_REQUIRED_PERMISSION,
  getRequiredPermissionForPath,
  PERMISSION_DEV_CONSOLE,
} from "@/hooks/useMyPermissions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/i18n";

const navRoutes = [
  { to: "/vehicles", key: "nav.vehicles" as const, icon: Car, permission: "vehiculos:entries:read" },
  { to: "/till", key: "nav.till" as const, icon: DollarSign, permission: "caja:treasury:read" },
  { to: "/metrics", key: "nav.metrics" as const, icon: BarChart3, permission: "metricas:dashboard:read" },
  { to: "/roles", key: "nav.roles" as const, icon: Shield, permission: "roles:users:read" },
  { to: "/backup", key: "nav.backup" as const, icon: Database, permission: "backup:list:read" },
  { to: "/drive", key: "nav.drive" as const, icon: Cloud, permission: "drive:status:read" },
];

const devNavRoute = { to: "/dev-console", key: "nav.devConsole" as const, icon: Terminal, permission: PERMISSION_DEV_CONSOLE };

const ALLOWED_FALLBACK_ORDER = ["/vehicles", "/till", "/metrics", "/roles", "/backup", "/drive"];

export const AppLayout = () => {
  const { t, locale, setLocale } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTauri: tauri } = useParkingStore();
  const { user, logout } = useSession();
  const { hasPermission } = useMyPermissions(!!user);

  const visibleNavRoutes =
    tauri && user ? navRoutes.filter((r) => hasPermission(r.permission)) : navRoutes;
  const canAccessDevConsole = import.meta.env.DEV && hasPermission(PERMISSION_DEV_CONSOLE);

  useEffect(() => {
    if (!tauri || !user) return;
    const required = getRequiredPermissionForPath(location.pathname);
    if (required && !hasPermission(required)) {
      const firstAllowed = ALLOWED_FALLBACK_ORDER.find(
        (path) => ROUTE_REQUIRED_PERMISSION[path] && hasPermission(ROUTE_REQUIRED_PERMISSION[path])
      );
      navigate(firstAllowed ?? "/vehicles", { replace: true });
    }
  }, [tauri, user, location.pathname, hasPermission, navigate]);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Car className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm">{t("app.name")}</h1>
              <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
            </div>
          </div>
          {tauri && user && (
            <div className="mt-3 pt-3 border-t border-border">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs font-normal h-8">
                    <span className="truncate">{user.displayName || user.username}</span>
                    <span className="text-muted-foreground ml-1">({user.roleName})</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => void logout()}>
                    <LogOut className="h-4 w-4 mr-2" />
                    {t("auth.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger className="h-8 text-xs gap-1.5">
                <Languages className="h-3.5 w-3.5" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {tauri ? (
              <>
                <HardDrive className="h-3 w-3 text-green-600 shrink-0" />
                <span>SQLite</span>
              </>
            ) : (
              <>
                <Cpu className="h-3 w-3 text-amber-600 shrink-0" />
                <span>Sin backend (memoria)</span>
              </>
            )}
          </div>
        </div>
        <nav className="p-2 flex-1">
          {visibleNavRoutes.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {t(key)}
            </NavLink>
          ))}
          {canAccessDevConsole && (
            <NavLink
              to={devNavRoute.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2 border-t border-border pt-2",
                  isActive
                    ? "bg-warning/10 text-warning"
                    : "text-muted-foreground hover:bg-warning/5 hover:text-warning"
                )
              }
            >
              <Terminal className="h-5 w-5 shrink-0" />
              {t(devNavRoute.key)}
            </NavLink>
          )}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
