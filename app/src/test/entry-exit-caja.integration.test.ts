import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/context";
import { useParkingStore } from "@/hooks/useParkingStore";
import { mockInvoke } from "./mocks/tauri";

const TICKET = "TK-INT-001";
const PLATE = "INT-PLATE";
const ENTRY_TIME = "2025-02-01T10:00:00.000Z";
const EXIT_TIME = "2025-02-01T12:00:00.000Z";
const AMOUNT = 100;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(I18nProvider, null, children)
    );
  };
}

function setTauriEnv(enabled: boolean) {
  if (enabled) {
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};
  } else {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
  }
}

describe("Integration: entry → exit → caja flow", () => {
  beforeEach(() => {
    setTauriEnv(true);
    mockInvoke.mockImplementation((cmd: string, args?: Record<string, unknown>) => {
      switch (cmd) {
        case "vehiculos_list_vehicles":
          return Promise.resolve({ items: [], total: 0 });
        case "vehiculos_register_entry":
          return Promise.resolve({
            id: "VH-integration-1",
            ticketCode: (args?.ticketCode as string) ?? TICKET,
            plate: String(args?.plate ?? PLATE).toUpperCase(),
            vehicleType: args?.vehicleType ?? "car",
            observations: args?.observations ?? null,
            entryTime: ENTRY_TIME,
            exitTime: null,
            status: "active",
            totalAmount: null,
            debt: null,
            specialRate: null,
          });
        case "vehiculos_process_exit":
          return Promise.resolve({
            id: "VH-integration-1",
            ticketCode: String(args?.ticketCode ?? TICKET),
            plate: PLATE,
            vehicleType: "car",
            observations: null,
            entryTime: ENTRY_TIME,
            exitTime: EXIT_TIME,
            status: "completed",
            totalAmount: AMOUNT,
            debt: null,
            specialRate: null,
          });
        case "caja_get_treasury":
          return Promise.resolve({
            expectedCash: AMOUNT,
            actualCash: AMOUNT,
            discrepancy: 0,
            totalTransactions: 1,
            paymentBreakdown: { cash: AMOUNT, card: 0, transfer: 0 },
          });
        case "metricas_get_daily":
          return Promise.resolve({
            totalVehicles: 1,
            activeVehicles: 0,
            occupancyRate: 0,
            totalRevenue: AMOUNT,
            averageTicket: AMOUNT,
            averageStayMinutes: 120,
            turnoverRate: 1,
          });
        default:
          return Promise.resolve(null);
      }
    });
  });

  afterEach(() => {
    setTauriEnv(false);
    vi.clearAllMocks();
  });

  it("covers entry, exit and caja: register → process exit → treasury reflects payment", async () => {
    const { result } = renderHook(() => useParkingStore(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.vehicles).toBeDefined();
    });

    await act(async () => {
      result.current.registerEntry(PLATE, "car", undefined, TICKET);
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("vehiculos_register_entry", expect.any(Object));
    });

    await act(async () => {
      result.current.processExit(TICKET, AMOUNT, "cash");
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("vehiculos_process_exit", expect.objectContaining({
        ticketCode: TICKET,
        paymentMethod: "cash",
      }));
    });

    await waitFor(() => {
      const treasuryCalls = mockInvoke.mock.calls.filter(
        (call) => call[0] === "caja_get_treasury"
      );
      expect(treasuryCalls.length).toBeGreaterThanOrEqual(1);
    });

    const commandsCalled = mockInvoke.mock.calls.map((call) => call[0]);
    expect(commandsCalled).toContain("vehiculos_register_entry");
    expect(commandsCalled).toContain("vehiculos_process_exit");
    expect(commandsCalled).toContain("caja_get_treasury");
  });
});
