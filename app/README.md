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
