import type { CustomTariff } from "@/types/parking";

const BUILTIN_TARIFF_I18N_KEYS: Record<string, string> = {
  default_car: "tariffs.defaultCar",
  default_motorcycle: "tariffs.defaultMotorcycle",
  default_truck: "tariffs.defaultTruck",
  default_bicycle: "tariffs.defaultBicycle",
  tariff_employee_car: "tariffs.employeeCar",
  tariff_employee_moto: "tariffs.employeeMoto",
  tariff_student_moto: "tariffs.studentMoto",
};

export function getTariffDisplayName(
  tariff: CustomTariff,
  t: (key: string) => string,
  fallbackLabelKey = "tariffs.defaultLabel"
): string {
  const key = BUILTIN_TARIFF_I18N_KEYS[tariff.id];
  if (key) return t(key);
  const name = tariff.name?.trim();
  if (name) return name;
  const plateOrRef = tariff.plateOrRef?.trim();
  if (plateOrRef) return plateOrRef;
  return t(fallbackLabelKey);
}
