import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { I18nProvider, useI18n } from "./context";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe("i18n", () => {
  it("useI18n returns t, locale, setLocale and translations", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("en");
    expect(typeof result.current.t).toBe("function");
    expect(typeof result.current.setLocale).toBe("function");
    expect(result.current.translations).toBeDefined();
  });

  it("t() returns string for dot path", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("nav.vehicles")).toBe("Vehicles");
    expect(result.current.t("nav.till")).toBe("Till");
    expect(result.current.t("common.cancel")).toBe("Cancel");
    expect(result.current.t("vehicles.title")).toBe("Vehicle Manager");
  });

  it("setLocale changes locale and t() returns translated strings", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("nav.vehicles")).toBe("Vehicles");

    act(() => {
      result.current.setLocale("es");
    });
    expect(result.current.locale).toBe("es");
    expect(result.current.t("nav.vehicles")).toBe("Vehículos");
    expect(result.current.t("common.cancel")).toBe("Cancelar");
  });

  it("unknown key returns key", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("unknown.key")).toBe("unknown.key");
  });
});
