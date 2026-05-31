import type { SKU, Batch, Location, Pallet, Movement, WarehouseTask, WarehouseTaskLine, OutboundDocument } from "@/types";

const now = new Date().toISOString();
const baseDate = new Date("2026-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(days: number) {
  return new Date(baseDate.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

const skuSeeds = [
  { skuCode: "MANGO-20KG", skuName: "Puree xoài 20kg", uom: "Carton", weightPerUnit: 20, storageType: "Frozen" },
  { skuCode: "PINE-15KG", skuName: "Puree dứa 15kg", uom: "Carton", weightPerUnit: 15, storageType: "Frozen" },
  { skuCode: "PASS-10KG", skuName: "Puree chanh dây 10kg", uom: "Carton", weightPerUnit: 10, storageType: "Frozen" },
  { skuCode: "SUGAR-25KG", skuName: "Đường tinh luyện 25kg", uom: "Bag", weightPerUnit: 25, storageType: "Dry" },
] as const;

const genericSkuTypes = ["Frozen", "Chilled", "Dry"] as const;

export const mockSKUs: SKU[] = [
  ...skuSeeds,
  ...Array.from({ length: 96 }, (_, idx) => {
    const no = idx + 5;
    const skuCode = `SKU-${String(no).padStart(3, "0")}`;
    const storageType = genericSkuTypes[idx % genericSkuTypes.length];
    const uom = storageType === "Dry" ? "Bag" : "Carton";
    return {
      skuCode,
      skuName: `Sample SKU ${String(no).padStart(3, "0")}`,
      uom,
      weightPerUnit: 5 + ((idx * 3) % 26),
      storageType,
    };
  }),
].map((sku, idx) => ({
  ...sku,
  id: String(idx + 1),
  createdAt: now,
  updatedAt: now,
}));

const explicitBatches: Record<string, { batchNo: string; mfgDate: string; expDate: string }> = {
  "MANGO-20KG": { batchNo: "LOT260527-A", mfgDate: "2026-05-27", expDate: "2028-05-27" },
  "PINE-15KG": { batchNo: "LOT260520-B", mfgDate: "2026-05-20", expDate: "2028-05-20" },
  "PASS-10KG": { batchNo: "LOT260515-C", mfgDate: "2026-05-15", expDate: "2028-05-15" },
  "SUGAR-25KG": { batchNo: "LOT260510-D", mfgDate: "2026-05-10", expDate: "2027-05-10" },
};

function generateBatchesForSku(sku: SKU, skuIndex: number): Batch[] {
  return Array.from({ length: 50 }, (_, idx) => {
    const batchIndex = idx + 1;
    const explicit = batchIndex === 1 ? explicitBatches[sku.skuCode] : undefined;
    const batchNo = explicit?.batchNo ?? `${sku.skuCode.replace(/[^A-Z0-9]/g, "")}-B${String(batchIndex).padStart(2, "0")}`;
    const mfgDate = explicit?.mfgDate ?? addDays(30 + skuIndex * 5 + batchIndex * 3);
    const expDate = explicit?.expDate ?? addDays(760 + skuIndex * 5 + batchIndex * 3);
    return {
      id: `b${String(skuIndex + 1).padStart(3, "0")}-${String(batchIndex).padStart(2, "0")}`,
      batchNo,
      skuCode: sku.skuCode,
      mfgDate,
      expDate,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export const mockBatches: Batch[] = mockSKUs.flatMap((sku, idx) => generateBatchesForSku(sku, idx));

type PalletSeed = Omit<Pallet, "id" | "createdAt" | "updatedAt">;

const explicitPalletSeedsBySkuCode: Record<string, PalletSeed & { id: string }> = {
  "MANGO-20KG": {
    id: "p1",
    palletId: "PLT-20260520-0001",
    skuCode: "MANGO-20KG",
    skuName: "Puree xoài 20kg",
    batchNo: "LOT260527-A",
    qty: 50,
    uom: "Carton",
    weight: 1000,
    mfgDate: "2026-05-27",
    expDate: "2028-05-27",
    currentLocation: "FZ-A-01-01",
    status: "In Stock",
  },
  "PINE-15KG": {
    id: "p2",
    palletId: "PLT-20260520-0002",
    skuCode: "PINE-15KG",
    skuName: "Puree dứa 15kg",
    batchNo: "LOT260520-B",
    qty: 40,
    uom: "Carton",
    weight: 600,
    mfgDate: "2026-05-20",
    expDate: "2028-05-20",
    currentLocation: "FZ-A-01-02",
    status: "In Stock",
  },
  "SUGAR-25KG": {
    id: "p3",
    palletId: "PLT-20260521-0003",
    skuCode: "SUGAR-25KG",
    skuName: "Đường tinh luyện 25kg",
    batchNo: "LOT260510-D",
    qty: 30,
    uom: "Bag",
    weight: 750,
    mfgDate: "2026-05-10",
    expDate: "2027-05-10",
    currentLocation: "DRY-A-01-01",
    status: "In Stock",
  },
  "PASS-10KG": {
    id: "p4",
    palletId: "PLT-20260525-0004",
    skuCode: "PASS-10KG",
    skuName: "Puree chanh dây 10kg",
    batchNo: "LOT260515-C",
    qty: 60,
    uom: "Carton",
    weight: 600,
    mfgDate: "2026-05-15",
    expDate: "2028-05-15",
    currentLocation: "RCV-01",
    status: "Pending Putaway",
  },
};

const reservedStorageOccupancy: Record<string, number> = {
  "FZ-A-01-01": 1,
  "FZ-A-01-02": 1,
  "DRY-A-01-01": 1,
};

const operationalLocations: Location[] = [
  { id: "l0", locationCode: "RCV-01", locationName: "Receiving Area 1", locationType: "RECEIVING", zone: "RECV", block: "-", aisle: "-", capacityPallet: 100, currentPalletCount: 1, status: "Active", createdAt: now, updatedAt: now },
  { id: "l1", locationCode: "STG-01", locationName: "Staging Area 1", locationType: "STAGING", zone: "STG", block: "-", aisle: "-", capacityPallet: 50, currentPalletCount: 0, status: "Active", createdAt: now, updatedAt: now },
  { id: "l2", locationCode: "DOCK-01", locationName: "Loading Dock 1", locationType: "DOCK", zone: "DOCK", block: "-", aisle: "-", capacityPallet: 30, currentPalletCount: 0, status: "Active", createdAt: now, updatedAt: now },
];

const storageZones = [
  { zone: "FZ-A", label: "Frozen Zone A", capacityPallet: 2 },
  { zone: "FZ-B", label: "Frozen Zone B", capacityPallet: 2 },
  { zone: "CHL-A", label: "Chilled Zone A", capacityPallet: 2 },
  { zone: "DRY-A", label: "Dry Zone A", capacityPallet: 4 },
  { zone: "DRY-B", label: "Dry Zone B", capacityPallet: 4 },
] as const;

const specialBinStatus: Record<string, Location["status"]> = {
  "DRY-A-01-02": "Blocked",
};

function buildStorageSlots(): string[] {
  const slots: string[] = [];
  storageZones.forEach((zoneDef, zoneIdx) => {
    for (let aisle = 1; aisle <= 20; aisle += 1) {
      for (let tier = 1; tier <= 5; tier += 1) {
        const aisleCode = String(aisle).padStart(2, "0");
        const tierCode = String(tier).padStart(2, "0");
        const locationCode = `${zoneDef.zone}-${aisleCode}-${tierCode}`;
        if (specialBinStatus[locationCode] === "Blocked") continue;
        const reservedCount = reservedStorageOccupancy[locationCode] ?? 0;
        const availableSlots = Math.max(0, zoneDef.capacityPallet - reservedCount);
        for (let slot = 0; slot < availableSlots; slot += 1) {
          slots.push(locationCode);
        }
      }
    }
  });
  return slots;
}

function buildGeneratedPallets(): Pallet[] {
  const storageSlots = buildStorageSlots();
  let storageSlotIndex = 0;
  let nextPalletNumber = 5;

  // Seed 10 pallets per SKU. The first 4 preserve the original demo pallets;
  // the rest consume storage slots sequentially so bin occupancy stays coherent.
  return mockSKUs.flatMap((sku, skuIndex) => {
    return Array.from({ length: 10 }, (_, batchOffset) => {
      const batchIndex = batchOffset + 1;
      const explicit = batchIndex === 1 ? explicitPalletSeedsBySkuCode[sku.skuCode] : undefined;
      const batchNo = batchIndex === 1
        ? explicit?.batchNo ?? `${sku.skuCode.replace(/[^A-Z0-9]/g, "")}-B${String(batchIndex).padStart(2, "0")}`
        : `${sku.skuCode.replace(/[^A-Z0-9]/g, "")}-B${String(batchIndex).padStart(2, "0")}`;
      const status = explicit?.status ?? (batchIndex % 6 === 0 ? "Staged" : "In Stock");
      const currentLocation = explicit?.currentLocation ?? (status === "Pending Putaway" ? "RCV-01" : storageSlots[storageSlotIndex++] ?? null);
      const qty = explicit?.qty ?? 24 + ((skuIndex * 7 + batchIndex * 5) % 37);
      const palletId = explicit?.palletId ?? `PLT-20260601-${String(nextPalletNumber).padStart(4, "0")}`;
      const id = explicit?.id ?? `p${nextPalletNumber}`;
      const weight = explicit?.weight ?? qty * sku.weightPerUnit;
      const mfgDate = explicit?.mfgDate ?? addDays(30 + skuIndex * 5 + batchIndex * 3);
      const expDate = explicit?.expDate ?? addDays(760 + skuIndex * 5 + batchIndex * 3);

      if (!explicit) nextPalletNumber += 1;

      return {
        id,
        palletId,
        skuCode: sku.skuCode,
        skuName: sku.skuName,
        batchNo,
        qty,
        uom: sku.uom,
        weight,
        mfgDate,
        expDate,
        currentLocation,
        status,
        createdAt: now,
        updatedAt: now,
      } as Pallet;
    });
  });
}

function buildLocationCounts(pallets: Pallet[]): Map<string, number> {
  const counts = new Map<string, number>();
  pallets.forEach((pallet) => {
    if (!pallet.currentLocation) return;
    counts.set(pallet.currentLocation, (counts.get(pallet.currentLocation) ?? 0) + 1);
  });
  return counts;
}

function buildStorageBins(locationCounts: Map<string, number>): Location[] {
  const bins: Location[] = [];
  storageZones.forEach((zoneDef, zoneIdx) => {
    for (let aisle = 1; aisle <= 20; aisle += 1) {
      for (let tier = 1; tier <= 5; tier += 1) {
        const aisleCode = String(aisle).padStart(2, "0");
        const tierCode = String(tier).padStart(2, "0");
        const locationCode = `${zoneDef.zone}-${aisleCode}-${tierCode}`;
        bins.push({
          id: `l${String(zoneIdx + 3).padStart(2, "0")}${aisleCode}${tierCode}`,
          locationCode,
          locationName: `${zoneDef.label} - Aisle ${aisleCode} - Tier ${tierCode}`,
          locationType: "STORAGE",
          zone: zoneDef.zone,
          block: aisleCode,
          aisle: aisleCode,
          tier: tierCode,
          capacityPallet: zoneDef.capacityPallet,
          currentPalletCount: locationCounts.get(locationCode) ?? 0,
          status: specialBinStatus[locationCode] ?? "Active",
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  });
  return bins;
}

export const mockPallets: Pallet[] = buildGeneratedPallets();
const locationCounts = buildLocationCounts(mockPallets);
export const mockLocations: Location[] = [
  {
    ...operationalLocations[0],
    currentPalletCount: locationCounts.get("RCV-01") ?? operationalLocations[0].currentPalletCount,
  },
  {
    ...operationalLocations[1],
    currentPalletCount: locationCounts.get("STG-01") ?? operationalLocations[1].currentPalletCount,
  },
  {
    ...operationalLocations[2],
    currentPalletCount: locationCounts.get("DOCK-01") ?? operationalLocations[2].currentPalletCount,
  },
  ...buildStorageBins(locationCounts),
];

export const mockMovements: Movement[] = [
  { id: "m1", movementId: "MV-0001", movementType: "PUT", palletId: "PLT-20260520-0001", skuCode: "MANGO-20KG", batchNo: "LOT260527-A", qty: 50, weight: 1000, fromLocation: "RCV-01", toLocation: "FZ-A-01-01", user: "demo", timestamp: now },
  { id: "m2", movementId: "MV-0002", movementType: "PUT", palletId: "PLT-20260520-0002", skuCode: "PINE-15KG", batchNo: "LOT260520-B", qty: 40, weight: 600, fromLocation: "RCV-01", toLocation: "FZ-A-01-02", user: "demo", timestamp: now },
  { id: "m3", movementId: "MV-0003", movementType: "PUT", palletId: "PLT-20260521-0003", skuCode: "SUGAR-25KG", batchNo: "LOT260510-D", qty: 30, weight: 750, fromLocation: "RCV-01", toLocation: "DRY-A-01-01", user: "demo", timestamp: now },
  { id: "m4", movementId: "MV-0004", movementType: "LABEL_ATTACHED", palletId: "PLT-20260525-0004", skuCode: "PASS-10KG", batchNo: "LOT260515-C", qty: 60, weight: 600, fromLocation: "RCV-01", toLocation: "RCV-01", user: "demo", timestamp: now },
];

export const mockTasks: WarehouseTask[] = [
  {
    id: "t1",
    taskNo: "TASK-0001",
    taskType: "PUTAWAY",
    status: "Open",
    printCount: 0,
    priority: "Normal",
    createdBy: "demo",
    createdAt: now,
    instruction: "Đưa pallet từ RCV-01 vào bin chỉ định.",
  },
];

export const mockTaskLines: WarehouseTaskLine[] = [
  {
    id: "t1-l1",
    taskId: "t1",
    taskNo: "TASK-0001",
    lineNo: 1,
    palletId: "PLT-20260525-0004",
    skuCode: "PASS-10KG",
    skuName: "Puree chanh dây 10kg",
    batchNo: "LOT260515-C",
    qty: 60,
    uom: "Carton",
    weight: 600,
    fromLocation: "RCV-01",
    toLocation: "FZ-B-01-01",
    actualLocation: null,
    status: "Open",
  },
];

export const mockOutbounds: OutboundDocument[] = [];
