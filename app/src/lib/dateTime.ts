export const APP_TIMEZONE = "America/Bogota";

export function getAppTimezone(): string {
  return APP_TIMEZONE;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  try {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: APP_TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: APP_TIMEZONE,
  dateStyle: "short",
});

export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    return dateTimeFormatter.format(d);
  } catch {
    return "—";
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    return dateFormatter.format(d);
  } catch {
    return "—";
  }
}

export function formatDateTimeLong(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: APP_TIMEZONE,
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(d);
  } catch {
    return "—";
  }
}

export function getLocalDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

export function formatDateTimePattern(
  value: string | Date | null | undefined,
  pattern: { dateStyle?: "short" | "medium" | "long"; timeStyle?: "short" | "medium" | "long" }
): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: APP_TIMEZONE,
      ...pattern,
    }).format(d);
  } catch {
    return "—";
  }
}

export function formatIsoInAppTz(value: string | Date | null | undefined): string {
  return formatDateTimePattern(value, { dateStyle: "short", timeStyle: "short" });
}

export function formatDateTimeIso(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const mo = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const h = parts.find((p) => p.type === "hour")?.value ?? "";
    const min = parts.find((p) => p.type === "minute")?.value ?? "";
    return `${y}-${mo}-${day} ${h}:${min}`;
  } catch {
    return "—";
  }
}
