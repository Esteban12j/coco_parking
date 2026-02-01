# Unit tests

- **Run**: `npm run test` (single run) or `npm run test:watch` (watch mode).
- **Stack**: Vitest, @testing-library/react, jsdom.

## Mocks (real-time / external deps)

Mocks live in `test/mocks/tauri.ts` and are loaded in `setup.ts`.

| Mock | Purpose |
|------|--------|
| **invoke** | Backend commands (DB, Tauri IPC). Use `mockInvoke.mockResolvedValue(...)` in tests to simulate responses. |
| **event listen** | Barcode pistol scanner: app listens to `barcode-scanned`. Use `emitBarcodeScanned(code)` in tests to simulate a scan without a real device. |

### Barcode scanner

- In the app, only the Vehicles page (scanner view) handles `barcode-scanned`; the mock lets tests trigger that event.
- Example: `import { emitBarcodeScanned } from "@/test/mocks/tauri";` then `emitBarcodeScanned("TK123");` and assert on the resulting state or UI.

### Backend / DB

- Use `mockInvoke.mockResolvedValue(...)` (or `mockRejectedValue`) before calling code that uses `invokeTauri` / backend commands (e.g. `vehiculos_list_vehicles`). The app uses `@/lib/tauriInvoke` which calls `invoke` from `@tauri-apps/api/core`, so mocking that module affects all Tauri calls.
- Reset with `mockInvoke.mockReset()` in `beforeEach` if needed.

## Where tests live

- `src/**/*.test.ts` or `*.spec.ts`: next to the code or in `src/test/` (e.g. `barcode-scanner.test.ts`).
- Rust: `src-tauri/src/**/tests` modules or `#[cfg(test)] mod tests` in the same file (e.g. `scanner.rs`).
