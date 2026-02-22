import type { VehicleType } from "@/types/parking";

export type ObservationGroup = { label: string; items: string[] };

const CAR_GROUPS: ObservationGroup[] = [
  {
    label: "Estado exterior",
    items: [
      "Ninguna novedad",
      "Rayón leve",
      "Rayón profundo",
      "Abolladura leve",
      "Abolladura fuerte",
      "Parachoques delantero golpeado",
      "Parachoques trasero golpeado",
      "Puerta derecha golpeada",
      "Puerta izquierda golpeada",
      "Capó rayado",
      "Baúl rayado",
      "Techo golpeado",
      "Espejo lateral derecho roto",
      "Espejo lateral izquierdo roto",
      "Vidrio lateral roto",
      "Parabrisas rayado",
      "Parabrisas fisurado",
      "Stop roto",
      "Farola rota",
    ],
  },
  {
    label: "Llantas",
    items: ["Llanta baja", "Llanta pinchada", "Rin rayado", "Sin tapa de rin"],
  },
  {
    label: "Accesorios / Equipamiento",
    items: [
      "Sin antena",
      "Sin tapa gasolina",
      "Porta equipaje",
      "Bicicleta en parrilla",
      "Maletero abierto",
    ],
  },
  {
    label: "Interior visible",
    items: [
      "Tablero encendido (luces prendidas)",
      "Radio visible",
      "Objetos de valor visibles",
      "Mascota dentro del vehículo",
    ],
  },
];

const MOTORCYCLE_GROUPS: ObservationGroup[] = [
  {
    label: "Estado general",
    items: [
      "Ninguna novedad",
      "Rayón en tanque",
      "Tanque abollado",
      "Carenaje rayado",
      "Carenaje roto",
      "Guardabarros roto",
      "Exosto golpeado",
    ],
  },
  { label: "Llantas", items: ["Llanta baja", "Llanta pinchada"] },
  {
    label: "Accesorios",
    items: [
      "Sin espejos",
      "Espejo derecho roto",
      "Espejo izquierdo roto",
      "Sin placa visible",
      "Maleta lateral",
      "Caja trasera",
    ],
  },
  {
    label: "Elementos dejados",
    items: [
      "Deja casco",
      "Deja dos cascos",
      "Deja casco y chaqueta",
      "Deja casco y guantes",
      "Deja llaves",
      "Deja capa",
      "Deja casco y gorra",
    ],
  },
];

const BICYCLE_GROUPS: ObservationGroup[] = [
  {
    label: "Estado general",
    items: [
      "Ninguna novedad",
      "Rayón en marco",
      "Marco fisurado",
      "Rin torcido",
      "Llanta baja",
      "Llanta pinchada",
      "Sin sillín",
      "Sillín roto",
      "Manubrio torcido",
      "Freno suelto",
      "Cadena suelta",
    ],
  },
  {
    label: "Accesorios",
    items: [
      "Luz delantera",
      "Luz trasera",
      "Porta celular",
      "Canastilla",
      "Parrilla trasera",
      "Sin candado",
      "Con candado",
    ],
  },
];

const TRUCK_GROUPS: ObservationGroup[] = [
  {
    label: "Cabina",
    items: [
      "Ninguna novedad",
      "Puerta golpeada",
      "Espejo roto",
      "Parabrisas fisurado",
      "Farola rota",
      "Cabina rayada",
    ],
  },
  {
    label: "Carrocería / Carga",
    items: [
      "Estaca rayada",
      "Estaca golpeada",
      "Furgón rayado",
      "Furgón golpeado",
      "Carpa rota",
      "Sin carpa",
      "Carga visible",
      "Carga mal asegurada",
    ],
  },
  {
    label: "Llantas",
    items: ["Llanta baja", "Llanta pinchada", "Llanta desgastada"],
  },
];

export const ADMINISTRATIVE_OBSERVATIONS: string[] = [
  "Ingresa sin documentos",
  "Ingresa sin placa",
  "Placa poco visible",
  "Placa dañada",
  "Paga solo adicionales",
  "Deja llaves en administración",
  "Retira sin novedad",
  "Se le informa estado previo",
];

const BY_VEHICLE: Record<VehicleType, ObservationGroup[]> = {
  car: CAR_GROUPS,
  motorcycle: MOTORCYCLE_GROUPS,
  truck: TRUCK_GROUPS,
  bicycle: BICYCLE_GROUPS,
};

export function getObservationGroupsForVehicle(vehicleType: VehicleType): ObservationGroup[] {
  return BY_VEHICLE[vehicleType] ?? [];
}

export function getAllObservationOptionsForVehicle(vehicleType: VehicleType): string[] {
  const groups = getObservationGroupsForVehicle(vehicleType);
  const items = groups.flatMap((g) => g.items);
  return [...items, ...ADMINISTRATIVE_OBSERVATIONS];
}
