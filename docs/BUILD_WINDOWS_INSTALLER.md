# Building the Windows Installer (COCO Parking)

This document describes how to build the Windows installer for COCO Parking in a reproducible way, either via CI or locally.

## Requirements

| Tool   | Version / notes |
|--------|------------------|
| **Node.js** | 20 LTS (or 22 LTS). Use the version referenced in CI (see `.github/workflows/build-windows.yml`). |
| **npm**     | 9+ (comes with Node 20). |
| **Rust**    | Stable, with target `x86_64-pc-windows-msvc`. Minimum rust-version in the project: 1.70 (see `app/src-tauri/Cargo.toml`). |
| **OS (local)** | Windows 10/11 for building the installer. The CI runs on `windows-latest`. |
| **Tauri**   | 2.x (see `app/package.json` and `app/src-tauri/Cargo.toml`). |

### Windows-specific (local build)

- **Visual Studio Build Tools** or **Visual Studio** with the "Desktop development with C++" workload (for MSVC).
- **WebView2**: Usually already present on Windows 10/11. The installer can download it if missing (default).
- **VBScript** (for MSI): Required when building `.msi`. Enable via **Settings → Apps → Optional features → More Windows features** if you see errors like `failed to run light.exe`.

## Generating the installer

### Option 1: CI (GitHub Actions)

1. Push to `master` or `main`, or open a pull request targeting one of these branches. The workflow **Build Windows Installer** runs automatically.
2. Alternatively, run it manually: **Actions → Build Windows Installer → Run workflow**.
3. When the job finishes, open the run and download the artifact **coco-parking-windows-installer**. It contains the contents of `app/src-tauri/target/release/bundle/` (NSIS and/or MSI outputs).

Artifacts are the same as a local build: NSIS `*-setup.exe` and/or MSI `*.msi` depending on Tauri bundle configuration.

### Option 2: Local build (Windows)

From the repository root:

```bash
cd app
npm ci
npm run tauri build
```

Output:

- **NSIS installer:** `app/src-tauri/target/release/bundle/nsis/*.exe` (e.g. `COCO Parking_0.1.0_x64-setup.exe`).
- **MSI installer:** `app/src-tauri/target/release/bundle/msi/*.msi` (when `bundle.targets` includes MSI; with `"targets": "all"` both are produced).

## Bundle configuration

Installer format and options are defined in `app/src-tauri/tauri.conf.json` under `bundle` (and `bundle.windows` for Windows-specific options such as WebView2 install mode or NSIS/MSI settings). The project currently uses `"targets": "all"` so both NSIS and MSI are built on Windows.

## Target environment

- **OS:** Windows 10 or Windows 11 (64-bit).
- **Architecture:** x86_64 (default for `tauri build` on a 64-bit host).

## Reproducibility

- **CI:** Same Node and Rust setup every run (see workflow file for exact versions).
- **Local:** Use the same Node and Rust versions as in the table above and run `npm ci` (no `npm install`) so dependency versions match `package-lock.json`.
