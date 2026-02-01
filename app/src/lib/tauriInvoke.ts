import { invoke } from "@tauri-apps/api/core";

export const TAURI_INVOKE_RETRY_DEFAULTS = {
  maxRetries: 2,
  retryDelayMs: 1000,
} as const;

export type TauriInvokeRetryOptions = {
  maxRetries?: number;
  retryDelayMs?: number;
  retryCondition?: (error: unknown) => boolean;
};

function isRetryableByDefault(error: unknown): boolean {
  const msg = parseTauriError(error).toLowerCase();
  return (
    msg.includes("connection") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("unavailable") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseTauriError(error: unknown): string {
  if (error === null || error === undefined) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }
  if (typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  try {
    return String(error);
  } catch {
    return "Unknown error";
  }
}

export type InvokeTauriOptions = TauriInvokeRetryOptions & {
  retries?: number;
};

export async function invokeTauri<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: InvokeTauriOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? options?.retries ?? 0;
  const retryDelayMs = options?.retryDelayMs ?? TAURI_INVOKE_RETRY_DEFAULTS.retryDelayMs;
  const retryCondition = options?.retryCondition ?? isRetryableByDefault;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await invoke<T>(cmd, args);
      return result;
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries;
      const shouldRetry = retryCondition(err);
      if (isLastAttempt || !shouldRetry) {
        throw new Error(parseTauriError(lastError));
      }
      await delay(retryDelayMs * (attempt + 1));
    }
  }
  throw new Error(parseTauriError(lastError));
}
