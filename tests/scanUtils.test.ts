import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getState, resetStore, setState } from "@/services/store";
import { parseScannedCode, makeScanCode } from "@/utils/scan";
import type { Location, Pallet, WarehouseTask } from "@/types";

const now = "2026-06-01T00:00:00.000Z";

function seedScanFixture() {
  const base = getState();
  const pallets: Pallet[] = [
    {
      id: "pallet-1",
      palletId: "PLT-001",
      skuCode: "SKU-1",
      skuName: "SKU One",
      batchNo: "BATCH-1",
      qty: 12,
      uom: "EA",
      weight: 24,
      mfgDate: "2026-05-01",
      expDate: "2027-05-01",
      currentLocation: "BIN-A",
      status: "In Stock",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const locations: Location[] = [
    {
      id: "loc-1",
      locationCode: "BIN-A",
      locationName: "Bin A",
      locationType: "STORAGE",
      zone: "Z1",
      block: "B1",
      aisle: "A01",
      tier: "T01",
      capacityPallet: 4,
      currentPalletCount: 1,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const tasks: WarehouseTask[] = [
    {
      id: "task-1",
      taskNo: "TASK-001",
      taskType: "MOVE",
      status: "Printed",
      printCount: 1,
      priority: "Normal",
      createdBy: "demo",
      createdAt: now,
    },
  ];

  setState((s) => ({
    ...s,
    pallets,
    locations,
    tasks,
  }));
}

afterEach(() => {
  resetStore();
});

test("parseScannedCode resolves prefixed and fallback codes", () => {
  seedScanFixture();

  assert.deepEqual(parseScannedCode("PLT:plt-001"), {
    rawValue: "PLT:plt-001",
    normalizedValue: "PLT:plt-001",
    parsedType: "PALLET",
    parsedCode: "PLT-001",
  });

  assert.deepEqual(parseScannedCode("bin-a"), {
    rawValue: "bin-a",
    normalizedValue: "bin-a",
    parsedType: "LOCATION",
    parsedCode: "BIN-A",
  });

  assert.deepEqual(parseScannedCode("TASK:task-001"), {
    rawValue: "TASK:task-001",
    normalizedValue: "TASK:task-001",
    parsedType: "TASK",
    parsedCode: "TASK-001",
  });

  assert.deepEqual(parseScannedCode("unknown-code"), {
    rawValue: "unknown-code",
    normalizedValue: "unknown-code",
    parsedType: "UNKNOWN",
    parsedCode: null,
  });
});

test("makeScanCode formats QR payloads with prefix", () => {
  assert.equal(makeScanCode("PLT", "  PLT-001 "), "PLT:PLT-001");
  assert.equal(makeScanCode("LOC", "BIN-A"), "LOC:BIN-A");
  assert.equal(makeScanCode("TASK", "TASK-001"), "TASK:TASK-001");
});
