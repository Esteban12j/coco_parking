import { describe, it, expect } from "vitest";
import type { Contract } from "@/types/parking";
import {
  isContractInArrears,
  calculateContractExtraCharge,
  calculateExtraChargeFromContract,
  getContractStatus,
  type ContractSession,
} from "../lib/contractCharge";

describe("contractCharge logic", () => {
  const baseContract: Contract = {
    id: "1",
    clientName: "Test User",
    plate: "ABC123",
    plateUpper: "ABC123",
    vehicleType: "car",
    tariffKind: "regular",
    monthlyAmount: 100000,
    includedHoursPerDay: 1, // 1 hora = 60 min
    dateFrom: "2026-01-01",
    dateTo: "2026-03-10",
    status: "active",
    createdAt: "2026-01-01",
  };
  const today = new Date("2026-03-09T10:00:00");

  // --- isContractInArrears ---

  it("detects arrears if dateTo < today", () => {
    const c = { ...baseContract, dateTo: "2026-03-01" };
    expect(isContractInArrears(c, today)).toBe(true);
  });

  it("detects arrears if status='arrears' even if dateTo is future", () => {
    const c = { ...baseContract, status: "arrears", dateTo: "2026-04-01" };
    expect(isContractInArrears(c, today)).toBe(true);
  });

  it("does NOT detect arrears if status='active' and dateTo >= today", () => {
    const c = { ...baseContract, dateTo: "2026-03-10" };
    expect(isContractInArrears(c, today)).toBe(false);
  });

  it("does NOT detect arrears if status='cancelled' even if dateTo < today", () => {
    const c = { ...baseContract, status: "cancelled", dateTo: "2026-03-01" };
    expect(isContractInArrears(c, today)).toBe(false);
  });

  it("does NOT detect arrears if dateTo equals today (boundary)", () => {
    const boundary = new Date("2026-03-09T00:00:00");
    const c = { ...baseContract, dateTo: "2026-03-09" };
    expect(isContractInArrears(c, boundary)).toBe(false);
  });

  // --- calculateContractExtraCharge ---

  it("returns 0 if within included time", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T09:00:00"), // exactly 60 min = included
    };
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 30)).toBe(0);
  });

  it("returns 0 if within 1-minute float tolerance margin", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T09:00:30"), // 60.5 min — within 1-min margin
    };
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 30)).toBe(0);
  });

  it("charges only initialExtraCharge when exceeded by more than margin but less than 1 interval", () => {
    // 62 min used, 60 included → 2 min excess (past 1-min margin)
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T09:02:00"), // 62 min
    };
    // ceil(2/30) = 1 interval → initialExtraCharge + 1 * extraCharge
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 30)).toBe(2000 + 1000);
  });

  it("charges correctly for exactly 1 interval of excess (30 min)", () => {
    // 90 min used, 60 included → 30 min excess
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T09:30:00"), // 90 min
    };
    // ceil(30/30) = 1 interval
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 30)).toBe(2000 + 1 * 1000);
  });

  it("charges correctly for 2 full intervals of excess (60 min)", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T10:00:00"), // 120 min = 60 min excess
    };
    // ceil(60/30) = 2 intervals
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 30)).toBe(2000 + 2 * 1000);
  });

  it("charges partial interval as full (ceil behavior) — 31 min excess, interval 30", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T09:31:00"), // 91 min = 31 min excess
    };
    // ceil(31/30) = 2 intervals
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 30)).toBe(2000 + 2 * 1000);
  });

  it("does NOT divide by zero when extraIntervalMinutes is 0", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T10:00:00"), // 120 min
    };
    // interval=0 → return only initialExtraCharge
    expect(calculateContractExtraCharge(session, baseContract, 2000, 1000, 0)).toBe(2000);
  });

  // --- calculateExtraChargeFromContract (wrapper) ---

  it("calculateExtraChargeFromContract returns 0 if contract has no extra fields", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T10:00:00"),
    };
    const c = { ...baseContract }; // no extraChargeFirst/Repeat/Interval
    expect(calculateExtraChargeFromContract(session, c)).toBe(0);
  });

  it("calculateExtraChargeFromContract uses contract fields correctly", () => {
    const session: ContractSession = {
      entryTime: new Date("2026-03-09T08:00:00"),
      exitTime: new Date("2026-03-09T10:00:00"), // 120 min = 60 min excess
    };
    const c = {
      ...baseContract,
      extraChargeFirst: 5000,
      extraChargeRepeat: 2000,
      extraInterval: 30,
    };
    // ceil(60/30) = 2 intervals
    expect(calculateExtraChargeFromContract(session, c)).toBe(5000 + 2 * 2000);
  });

  // --- getContractStatus ---

  it("returns 'En mora' if in arrears", () => {
    const c = { ...baseContract, dateTo: "2026-03-01" };
    expect(getContractStatus(c, today)).toBe("En mora");
  });

  it("returns 'Activo' if not in arrears", () => {
    const c = { ...baseContract, dateTo: "2026-03-10" };
    expect(getContractStatus(c, today)).toBe("Activo");
  });

  it("returns 'Cancelado' if cancelled", () => {
    const c = { ...baseContract, status: "cancelled" };
    expect(getContractStatus(c, today)).toBe("Cancelado");
  });
});
