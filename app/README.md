# COCO Parking (Desktop)

Tauri 2 + React + TypeScript + Vite.

## Requirements

- Node.js 18+
- Rust: <https://rustup.rs/>
- Tauri prerequisites: <https://v2.tauri.app/start/prerequisites/>

## Development

```bash
cd app
npm install
npm run tauri:dev
```

## Build

```bash
cd app
npm run tauri:build
```

Artifacts: `app/src-tauri/target/release/bundle/` (Windows: .exe/.msi; macOS: .app/.dmg; Linux: .deb, .AppImage).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite only (no Tauri window) |
| `npm run tauri:dev` | Desktop app (dev) |
| `npm run tauri:build` | Build + installers |

## Troubleshooting

**Blank window on Linux / WSL2** (with libEGL / MESA warnings): the webview may fail to use the GPU. Try running with software rendering:

```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
```

Or:

```bash
LIBGL_ALWAYS_SOFTWARE=1 npm run tauri:dev
```

If the window stays blank, open http://localhost:5173 in a normal browser while `tauri:dev` is running. If the app loads there, the issue is the Tauri webview (graphics stack). On WSL2, using WSLg (Windows 11) or running the app natively on Windows/macOS often works better.
