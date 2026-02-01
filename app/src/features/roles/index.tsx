import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Shield, Plus, Pencil, Trash2, Key, Lock } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useMyPermissions } from "@/hooks/useMyPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser, Role } from "@/types/parking";

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export const RolesPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tauri = isTauri();
  const { hasPermission } = useMyPermissions();
  const canCreateUser = hasPermission("roles:users:create");
  const canModifyUser = hasPermission("roles:users:modify");
  const canDeleteUser = hasPermission("roles:users:delete");
  const canEditPermissions = hasPermission("roles:permissions:read") && hasPermission("roles:permissions:modify");

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AuthUser | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);

  const usersQuery = useQuery({
    queryKey: ["roles", "users"],
    queryFn: () => invoke<AuthUser[]>("roles_list_users"),
    enabled: tauri,
  });

  const rolesQuery = useQuery({
    queryKey: ["roles", "roles"],
    queryFn: () => invoke<Role[]>("roles_list_roles"),
    enabled: tauri,
  });

  const rolePermissionsQuery = useQuery({
    queryKey: ["roles", "permissions", permissionsRole?.id],
    queryFn: () => invoke<string[]>("roles_get_role_permissions", { roleId: permissionsRole!.id }),
    enabled: tauri && !!permissionsRole,
  });

  const createUserMutation = useMutation({
    mutationFn: (args: { username: string; password: string; displayName: string; roleId: string }) =>
      invoke<AuthUser>("roles_create_user", args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", "users"] });
      setCreateOpen(false);
      toast({ title: t("roles.userCreated") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (args: { userId: string; displayName?: string; roleId?: string }) =>
      invoke<AuthUser>("roles_update_user", args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", "users"] });
      setEditUser(null);
      toast({ title: t("roles.userUpdated") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => invoke("roles_delete_user", { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", "users"] });
      setEditUser(null);
      toast({ title: t("roles.userDeleted") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: (args: { userId: string; newPassword: string }) =>
      invoke("roles_set_password", args),
    onSuccess: () => {
      setPasswordUser(null);
      toast({ title: t("roles.passwordUpdated") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const updateRolePermissionsMutation = useMutation({
    mutationFn: (args: { roleId: string; permissions: string[] }) =>
      invoke("roles_update_role_permissions", args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", "permissions"] });
      setPermissionsRole(null);
      toast({ title: t("roles.permissionsUpdated") });
    },
    onError: (err: unknown) => {
      toast({ title: t("common.error"), description: String(err), variant: "destructive" });
    },
  });

  const users = usersQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const allPermissions = [
    "vehiculos:entries:read",
    "vehiculos:entries:create",
    "vehiculos:entries:modify",
    "vehiculos:entries:delete",
    "caja:treasury:read",
    "caja:transactions:read",
    "caja:transactions:create",
    "caja:transactions:modify",
    "caja:shift:close",
    "metricas:dashboard:read",
    "metricas:reports:export",
    "roles:users:read",
    "roles:users:create",
    "roles:users:modify",
    "roles:users:delete",
    "roles:users:assign",
    "roles:permissions:read",
    "roles:permissions:modify",
    "backup:list:read",
    "backup:create",
    "backup:restore",
    "dev:console:access",
  ];

  if (!tauri) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t("roles.title")}</h1>
          <p className="text-muted-foreground">{t("roles.subtitle")}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{t("roles.inDevelopment")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("roles.title")}</h1>
        <p className="text-muted-foreground">{t("roles.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("roles.users")}</CardTitle>
            <CardDescription>{t("roles.subtitle")}</CardDescription>
          </div>
          {canCreateUser && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("roles.addUser")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("roles.noUsers")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("roles.username")}</TableHead>
                  <TableHead>{t("roles.displayName")}</TableHead>
                  <TableHead>{t("roles.role")}</TableHead>
                  <TableHead>{t("roles.createdAt")}</TableHead>
                  <TableHead className="w-[120px]">{t("roles.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}</TableCell>
                    <TableCell>{u.displayName}</TableCell>
                    <TableCell>{u.roleName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canModifyUser && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditUser(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPasswordUser(u)}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {canDeleteUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (window.confirm(t("roles.confirmDeleteUser"))) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("roles.roles")}</CardTitle>
          <CardDescription>{t("roles.permissionsForRole")}</CardDescription>
        </CardHeader>
        <CardContent>
          {rolesQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          ) : roles.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("roles.noRoles")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <Button
                  key={r.id}
                  variant="outline"
                  onClick={() => setPermissionsRole(r)}
                  disabled={!canEditPermissions}
                >
                  {r.name}
                  <Lock className="h-4 w-4 ml-2" />
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        onSubmit={(username, password, displayName, roleId) =>
          createUserMutation.mutate({ username, password, displayName, roleId })
        }
        isPending={createUserMutation.isPending}
      />

      {editUser && (
        <EditUserDialog
          user={editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
          onSubmit={(displayName, roleId) =>
            updateUserMutation.mutate({ userId: editUser.id, displayName, roleId })
          }
          isPending={updateUserMutation.isPending}
        />
      )}

      {passwordUser && (
        <SetPasswordDialog
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
          onSubmit={(newPassword) =>
            setPasswordMutation.mutate({ userId: passwordUser.id, newPassword })
          }
          isPending={setPasswordMutation.isPending}
        />
      )}

      {permissionsRole && (
        <RolePermissionsDialog
          role={permissionsRole}
          currentPermissions={rolePermissionsQuery.data ?? []}
          allPermissions={allPermissions}
          onClose={() => setPermissionsRole(null)}
          onSubmit={(perms) =>
            updateRolePermissionsMutation.mutate({ roleId: permissionsRole.id, permissions: perms })
          }
          isPending={updateRolePermissionsMutation.isPending}
        />
      )}
    </div>
  );
};

function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: Role[];
  onSubmit: (username: string, password: string, displayName: string, roleId: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleId, setRoleId] = useState("");

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setDisplayName("");
      setRoleId(roles[0]?.id ?? "");
    }
  }, [open, roles]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password || !roleId) return;
    onSubmit(username.trim(), password, displayName.trim() || username.trim(), roleId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("roles.createUser")}</DialogTitle>
          <DialogDescription>{t("roles.addUser")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t("roles.username")}</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("roles.username")}
              required
            />
          </div>
          <div>
            <Label>{t("auth.password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              required
              minLength={4}
            />
          </div>
          <div>
            <Label>{t("roles.displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("roles.displayName")}
            />
          </div>
          <div>
            <Label>{t("roles.role")}</Label>
            <Select value={roleId} onValueChange={setRoleId} required>
              <SelectTrigger>
                <SelectValue placeholder={t("roles.role")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("roles.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  roles,
  onClose,
  onSubmit,
  isPending,
}: {
  user: AuthUser;
  roles: Role[];
  onClose: () => void;
  onSubmit: (displayName: string, roleId: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [roleId, setRoleId] = useState(user.roleId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(displayName, roleId);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("roles.editUser")}</DialogTitle>
          <DialogDescription>{user.username}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t("roles.displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("roles.displayName")}
            />
          </div>
          <div>
            <Label>{t("roles.role")}</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder={t("roles.role")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("roles.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SetPasswordDialog({
  user,
  onClose,
  onSubmit,
  isPending,
}: {
  user: AuthUser;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) return;
    onSubmit(newPassword);
    setNewPassword("");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("roles.setPassword")}</DialogTitle>
          <DialogDescription>{user.username}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t("roles.newPassword")}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("roles.newPassword")}
              minLength={4}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || newPassword.length < 4}>
              {t("roles.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RolePermissionsDialog({
  role,
  currentPermissions,
  allPermissions,
  onClose,
  onSubmit,
  isPending,
}: {
  role: Role;
  currentPermissions: string[];
  allPermissions: string[];
  onClose: () => void;
  onSubmit: (permissions: string[]) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentPermissions));

  useEffect(() => {
    setSelected(new Set(currentPermissions));
  }, [role.id, currentPermissions]);

  const toggle = (p: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(Array.from(selected));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("roles.editPermissions")}</DialogTitle>
          <DialogDescription>
            {t("roles.permissionsForRole")}: {role.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2 max-h-96 overflow-y-auto">
            {allPermissions.map((p) => (
              <div key={p} className="flex items-center space-x-2">
                <Checkbox
                  id={p}
                  checked={selected.has(p)}
                  onCheckedChange={() => toggle(p)}
                />
                <label
                  htmlFor={p}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {p}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {t("roles.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
