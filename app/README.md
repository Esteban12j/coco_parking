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

## Barcode scanner (Linux)

The app uses a **pistol/HID barcode scanner** that behaves like a keyboard: it types the code very fast and sends Enter. On Linux, the backend reads global keyboard events via `rdev`, which needs read access to `/dev/input/*`. For that, the user running the app must be in the **`input`** group.

### Steps (group `input`)

1. **Add your user to the `input` group** (one-time, requires admin):
   ```bash
   sudo usermod -aG input "$USER"
   ```
2. **Apply the change:** log out and log back in, or reboot. Group membership is read at login.
3. **Verify:**
   ```bash
   groups
   ```
   You should see `input` in the list. Alternatively: `id -nG` or `getent group input`.
4. **Run the app** (dev or installed). The scanner listener will then be able to read from `/dev/input/*`.

### Troubleshooting

| Symptom | What to do |
|--------|------------|
| Scanner does not trigger in the app | Ensure the user is in `input` and you have logged out/in after adding it. Run `groups` to confirm. |
| Permission denied on `/dev/input/*` | Same as above. If you cannot add the user to `input`, you can run the app with elevated permissions only for testing (e.g. `sudo -E npm run tauri:dev`); not recommended for normal use. |
| Scanner works in terminal but not in app | Focus must be on the Vehicles page (scanner view). The app only treats a short burst of keys + Enter as a scan when the scanner input is active. |
| Multiple input devices / wrong device | The backend listens to all keyboard events. If the scanner is recognized as a keyboard, it should be included. Unplug other HID keyboards if you need to isolate the scanner. |

### Installer and offline deployment

The application is intended to run **offline** and will be distributed via an **installer** for easy setup on new devices. When building the installer (e.g. .deb, .AppImage, or future installer script):

- **Document** that on Linux the user (or the device account used to run COCO Parking) must be in the `input` group for the barcode scanner to work.
- **Optional (installer):** The installer can add the installing user to `input` automatically (e.g. `usermod -aG input "$USER"`) and then inform the user to log out and back in. Do not add `root` or system users to `input`; only the desktop user that will run the app.
- **Post-install note:** Include in the installer’s finish screen or in a README that “On Linux, barcode scanner requires the user to be in the `input` group. If the scanner does not work, run: `sudo usermod -aG input $USER` and then log out and back in.”

See also **`app/src-tauri/README.md`** (section “Barcode scanner”) for backend details.
