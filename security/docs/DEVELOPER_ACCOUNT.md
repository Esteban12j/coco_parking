# Developer account (security note)

## Purpose

The developer account is a **hidden system user** intended only for **recovery and administration** in exceptional situations (e.g. lost admin access, backup/restore operations, or authorized maintenance). It is not meant for day-to-day use or for listing alongside normal users.

## Visibility

The developer account is **hidden** from the application UI:

- It does not appear in the roles/users list.
- List-user APIs exclude it via `hidden = 1` so it is never exposed in admin screens.

Only users who know the developer username and the build-time password can log in as developer.

## Permissions

Permissions for the developer role are **restricted** to recovery and administration:

- **Backup:** list, create, restore, and read/modify backup configuration.
- **Dev console:** access to the developer console (e.g. password reset for other users, DB inspection, restore testing).

The developer account does not receive broad application permissions; it cannot perform regular parking or business operations beyond what is needed for recovery and administration.

## Credentials

The developer password is set at **build time** via the `COCO_DEV_PASSWORD` environment variable. The password is hashed and embedded in the build artifact; it is never stored in source code or logged. If `COCO_DEV_PASSWORD` is not set at build time, the developer user is still created but cannot log in (no valid hash).
