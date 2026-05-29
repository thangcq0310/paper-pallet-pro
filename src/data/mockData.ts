import type { SKU, Batch, Location, Pallet, Movement, WarehouseTask, OutboundDocument } from "@/types";

const now = new Date().toISOString();

export const mockSKUs: SKU[] = [
  { id: "1", skuCode: "MANGO-20KG", skuName: "Puree xoài 20kg", uom: "Carton", weightPerUnit: 20, storageType: "Frozen", createdAt: now, updatedAt: now },
  { id: "2", skuCode: "PINE-15KG", skuName: "Puree dứa 15kg", uom: "Carton", weightPerUnit: 15, storageType: "Frozen", createdAt: now, updatedAt: now },
  { id: "3", skuCode: "PASS-10KG", skuName: "Puree chanh dây 10kg", uom: "Carton", weightPerUnit: 10, storageType: "Frozen", createdAt: now, updatedAt: now },
  { id: "4", skuCode: "SUGAR-25KG", skuName: "Đường tinh luyện 25kg", uom: "Bag", weightPerUnit: 25, storageType: "Dry", createdAt: now, updatedAt: now },
];

export const mockBatches: Batch[] = [
  { id: "b1", batchNo: "LOT260527-A", skuCode: "MANGO-20KG", mfgDate: "2026-05-27", expDate: "2028-05-27", createdAt: now, updatedAt: now },
  { id: "b2", batchNo: "LOT260520-B", skuCode: "PINE-15KG", mfgDate: "2026-05-20", expDate: "2028-05-20", createdAt: now, updatedAt: now },
  { id: "b3", batchNo: "LOT260515-C", skuCode: "PASS-10KG", mfgDate: "2026-05-15", expDate: "2028-05-15", createdAt: now, updatedAt: now },
  { id: "b4", batchNo: "LOT260510-D", skuCode: "SUGAR-25KG", mfgDate: "2026-05-10", expDate: "2027-05-10", createdAt: now, updatedAt: now },
];

export const mockLocations: Location[] = [
  { id: "l0", locationCode: "RCV-01", locationName: "Receiving Area 1", locationType: "RECEIVING", zone: "RECV", block: "-", capacityPallet: 100, currentPalletCount: 1, status: "Active", createdAt: now, updatedAt: now },
  { id: "l1", locationCode: "STG-01", locationName: "Staging Area 1", locationType: "STAGING", zone: "STG", block: "-", capacityPallet: 50, currentPalletCount: 0, status: "Active", createdAt: now, updatedAt: now },
  { id: "l2", locationCode: "DOCK-01", locationName: "Loading Dock 1", locationType: "DOCK", zone: "DOCK", block: "-", capacityPallet: 30, currentPalletCount: 0, status: "Active", createdAt: now, updatedAt: now },
  { id: "l4", locationCode: "FZ-A-01-01", locationType: "STORAGE", zone: "FZ-A", block: "01", capacityPallet: 2, currentPalletCount: 1, status: "Active", createdAt: now, updatedAt: now },
  { id: "l5", locationCode: "FZ-A-01-02", locationType: "STORAGE", zone: "FZ-A", block: "01", capacityPallet: 2, currentPalletCount: 1, status: "Active", createdAt: now, updatedAt: now },
  { id: "l6", locationCode: "FZ-B-01-01", locationType: "STORAGE", zone: "FZ-B", block: "01", capacityPallet: 2, currentPalletCount: 0, status: "Active", createdAt: now, updatedAt: now },
  { id: "l7", locationCode: "DRY-A-01-01", locationType: "STORAGE", zone: "DRY-A", block: "01", capacityPallet: 4, currentPalletCount: 1, status: "Active", createdAt: now, updatedAt: now },
  { id: "l8", locationCode: "DRY-A-01-02", locationType: "STORAGE", zone: "DRY-A", block: "01", capacityPallet: 4, currentPalletCount: 0, status: "Blocked", createdAt: now, updatedAt: now },
];

export const mockPallets: Pallet[] = [
  { id: "p1", palletId: "PLT-20260520-0001", skuCode: "MANGO-20KG", skuName: "Puree xoài 20kg", batchNo: "LOT260527-A", qty: 50, uom: "Carton", weight: 1000, mfgDate: "2026-05-27", expDate: "2028-05-27", currentLocation: "FZ-A-01-01", status: "In Stock", labelAttached: true, createdAt: now, updatedAt: now },
  { id: "p2", palletId: "PLT-20260520-0002", skuCode: "PINE-15KG", skuName: "Puree dứa 15kg", batchNo: "LOT260520-B", qty: 40, uom: "Carton", weight: 600, mfgDate: "2026-05-20", expDate: "2028-05-20", currentLocation: "FZ-A-01-02", status: "In Stock", labelAttached: true, createdAt: now, updatedAt: now },
  { id: "p3", palletId: "PLT-20260521-0003", skuCode: "SUGAR-25KG", skuName: "Đường tinh luyện 25kg", batchNo: "LOT260510-D", qty: 30, uom: "Bag", weight: 750, mfgDate: "2026-05-10", expDate: "2027-05-10", currentLocation: "DRY-A-01-01", status: "In Stock", labelAttached: true, createdAt: now, updatedAt: now },
  { id: "p4", palletId: "PLT-20260525-0004", skuCode: "PASS-10KG", skuName: "Puree chanh dây 10kg", batchNo: "LOT260515-C", qty: 60, uom: "Carton", weight: 600, mfgDate: "2026-05-15", expDate: "2028-05-15", currentLocation: "RCV-01", status: "Labeled", labelAttached: true, createdAt: now, updatedAt: now },
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
    palletId: "PLT-20260525-0004",
    skuCode: "PASS-10KG",
    skuName: "Puree chanh dây 10kg",
    batchNo: "LOT260515-C",
    qty: 60,
    uom: "Carton",
    weight: 600,
    fromLocation: "RCV-01",
    toLocation: "FZ-B-01-01",
    status: "Open",
    printCount: 0,
    priority: "Normal",
    createdBy: "demo",
    createdAt: now,
    instruction: "Đưa pallet từ RCV-01 vào location chỉ định.",
  },
];

export const mockOutbounds: OutboundDocument[] = [];
