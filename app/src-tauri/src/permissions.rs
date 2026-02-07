// Granular permissions by feature. Backend commands check these; frontend can hide UI by permission.
// Domain pattern: domain:resource:action (e.g. vehiculos:entries:read, dev:console:access).
//
// When adding a new permission: (1) add the const; (2) add it to all_permissions() so admin
// always has it (synced on every app start). Other roles (operator, etc.) do not get it
// automatically—the admin must assign it via Roles > Edit permissions. The frontend list
// of permissions is loaded from the backend (roles_list_all_permissions), so new permissions
// appear in the UI unchecked for non-admin roles until the admin enables them.

pub const VEHICULOS_ENTRIES_READ: &str = "vehiculos:entries:read";
pub const VEHICULOS_ENTRIES_CREATE: &str = "vehiculos:entries:create";
pub const VEHICULOS_ENTRIES_MODIFY: &str = "vehiculos:entries:modify";
pub const VEHICULOS_ENTRIES_DELETE: &str = "vehiculos:entries:delete";
pub const VEHICULOS_ENTRIES_REMOVE_FROM_PARKING: &str = "vehiculos:entries:remove_from_parking";

pub const CAJA_TREASURY_READ: &str = "caja:treasury:read";
pub const CAJA_DEBTORS_READ: &str = "caja:debtors:read";
pub const CAJA_TRANSACTIONS_READ: &str = "caja:transactions:read";
pub const CAJA_TRANSACTIONS_CREATE: &str = "caja:transactions:create";
pub const CAJA_TRANSACTIONS_MODIFY: &str = "caja:transactions:modify";
pub const CAJA_SHIFT_CLOSE: &str = "caja:shift:close";

pub const METRICAS_DASHBOARD_READ: &str = "metricas:dashboard:read";
pub const METRICAS_REPORTS_EXPORT: &str = "metricas:reports:export";

pub const ROLES_USERS_READ: &str = "roles:users:read";
pub const ROLES_USERS_CREATE: &str = "roles:users:create";
pub const ROLES_USERS_MODIFY: &str = "roles:users:modify";
pub const ROLES_USERS_DELETE: &str = "roles:users:delete";
pub const ROLES_USERS_ASSIGN: &str = "roles:users:assign";
pub const ROLES_PERMISSIONS_READ: &str = "roles:permissions:read";
pub const ROLES_PERMISSIONS_MODIFY: &str = "roles:permissions:modify";

pub const BACKUP_LIST_READ: &str = "backup:list:read";
pub const BACKUP_CREATE: &str = "backup:create";
pub const BACKUP_RESTORE: &str = "backup:restore";
pub const BACKUP_CONFIG_READ: &str = "backup:config:read";
pub const BACKUP_CONFIG_MODIFY: &str = "backup:config:modify";

pub const BARCODES_READ: &str = "barcodes:read";
pub const BARCODES_CREATE: &str = "barcodes:create";
pub const BARCODES_DELETE: &str = "barcodes:delete";

pub const DEV_CONSOLE_ACCESS: &str = "dev:console:access";

pub fn all_permissions() -> Vec<&'static str> {
    vec![
        VEHICULOS_ENTRIES_READ,
        VEHICULOS_ENTRIES_CREATE,
        VEHICULOS_ENTRIES_MODIFY,
        VEHICULOS_ENTRIES_DELETE,
        VEHICULOS_ENTRIES_REMOVE_FROM_PARKING,
        CAJA_TREASURY_READ,
        CAJA_DEBTORS_READ,
        CAJA_TRANSACTIONS_READ,
        CAJA_TRANSACTIONS_CREATE,
        CAJA_TRANSACTIONS_MODIFY,
        CAJA_SHIFT_CLOSE,
        METRICAS_DASHBOARD_READ,
        METRICAS_REPORTS_EXPORT,
        ROLES_USERS_READ,
        ROLES_USERS_CREATE,
        ROLES_USERS_MODIFY,
        ROLES_USERS_DELETE,
        ROLES_USERS_ASSIGN,
        ROLES_PERMISSIONS_READ,
        ROLES_PERMISSIONS_MODIFY,
        BACKUP_LIST_READ,
        BACKUP_CREATE,
        BACKUP_RESTORE,
        BACKUP_CONFIG_READ,
        BACKUP_CONFIG_MODIFY,
        BARCODES_READ,
        BARCODES_CREATE,
        BARCODES_DELETE,
        DEV_CONSOLE_ACCESS,
    ]
}

pub fn operator_permissions() -> Vec<&'static str> {
    vec![
        VEHICULOS_ENTRIES_READ,
        VEHICULOS_ENTRIES_CREATE,
        VEHICULOS_ENTRIES_MODIFY,
        CAJA_TREASURY_READ,
        CAJA_DEBTORS_READ,
        CAJA_TRANSACTIONS_READ,
        CAJA_TRANSACTIONS_CREATE,
        CAJA_TRANSACTIONS_MODIFY,
        CAJA_SHIFT_CLOSE,
        METRICAS_DASHBOARD_READ,
    ]
}
