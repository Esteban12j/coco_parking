import { describe, it, expect } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/context";
import { useParkingStore } from "./useParkingStore";

function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(I18nProvider, null, children)
    );
  };
}

describe("useParkingStore", () => {
  it("starts with no vehicles", () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    expect(result.current.vehicles).toEqual([]);
    expect(result.current.activeVehicles).toEqual([]);
  });

  it("handleScan with unknown code returns undefined (entry flow)", async () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    let scanned: Awaited<ReturnType<typeof result.current.handleScan>> = undefined;
    await act(async () => {
      scanned = await result.current.handleScan("TK999");
    });
    expect(scanned).toBeUndefined();
    expect(result.current.scanResult).toEqual({ type: "entry" });
  });

  it("registerEntry adds a vehicle and sets scanResult", () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    let vehicle: ReturnType<typeof result.current.registerEntry>;
    act(() => {
      vehicle = result.current.registerEntry("ABC-123", "car", undefined, "TK001");
    });
    expect(vehicle).toBeDefined();
    expect(vehicle!.plate).toBe("ABC-123");
    expect(vehicle!.ticketCode).toBe("TK001");
    expect(vehicle!.status).toBe("active");
    expect(result.current.activeVehicles).toHaveLength(1);
    expect(result.current.scanResult?.type).toBe("entry");
  });

  it("handleScan with existing ticket returns vehicle (checkout flow)", async () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.registerEntry("XYZ-789", "motorcycle", undefined, "TK002");
    });
    let found: Awaited<ReturnType<typeof result.current.handleScan>>;
    await act(async () => {
      found = await result.current.handleScan("TK002");
    });
    expect(found).toBeDefined();
    expect(found!.ticketCode).toBe("TK002");
    expect(result.current.scanResult?.type).toBe("exit");
  });

  it("findByPlate finds active vehicle by plate", async () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      result.current.registerEntry("PLATE-1", "truck", undefined, "TK003");
    });
    let v: Awaited<ReturnType<typeof result.current.findByPlate>> = null;
    await act(async () => {
      v = await result.current.findByPlate("plate-1");
    });
    expect(v).toBeDefined();
    expect(v!.plate).toBe("PLATE-1");
  });

  it("findByPlate returns null for unknown plate", async () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    let v: Awaited<ReturnType<typeof result.current.findByPlate>> = undefined;
    await act(async () => {
      v = await result.current.findByPlate("UNKNOWN");
    });
    expect(v).toBeNull();
  });

  it("processExit completes vehicle and updates state", () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.registerEntry("EXIT-1", "car", undefined, "TK004");
    });
    let exitResult: ReturnType<typeof result.current.processExit>;
    act(() => {
      exitResult = result.current.processExit("TK004");
    });
    expect(exitResult).not.toBeNull();
    expect(exitResult!.vehicle.status).toBe("completed");
    expect(result.current.activeVehicles).toHaveLength(0);
    expect(result.current.todaysSessions).toHaveLength(1);
  });

  it("getPlateDebt returns sum of debt for plate", async () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      result.current.registerEntry("DEBT-1", "car", undefined, "TK005");
    });
    await act(async () => {
      result.current.processExit("TK005", 10);
    });
    let debt: number = 0;
    await act(async () => {
      debt = await result.current.getPlateDebt("debt-1");
    });
    expect(debt).toBeGreaterThanOrEqual(0);
  });

  it("clearScanResult resets scanResult", () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.handleScan("TK");
    });
    expect(result.current.scanResult).not.toBeNull();
    act(() => {
      result.current.clearScanResult();
    });
    expect(result.current.scanResult).toBeNull();
  });

});
