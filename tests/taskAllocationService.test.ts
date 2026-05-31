import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { autoAllocatePalletsToBins, getMultiTargetBinCapacityByTaskType } from "@/services/taskAllocationService";
import { resetStore, setState } from "@/services/store";
import type { Location, WarehouseTask, WarehouseTaskLine } from "@/types";

const now = "2026-05-31T00:00:00.000Z";

function seedAllocationFixture() {
  const locations: Location[] = [
    {
      id: "loc-a",
      locationCode: "BIN-A",
      locationName: "Bin A",
      locationType: "STORAGE",
      zone: "Z1",
      block: "B1",
      aisle: "A01",
      tier: "T01",
      capacityPallet: 5,
      currentPalletCount: 2,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "loc-b",
      locationCode: "BIN-B",
      locationName: "Bin B",
      locationType: "STORAGE",
      zone: "Z1",
      block: "B1",
      aisle: "A02",
      tier: "T01",
      capacityPallet: 4,
      currentPalletCount: 1,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "loc-c",
      locationCode: "DOCK-1",
      locationName: "Dock 1",
      locationType: "DOCK",
      zone: "Z0",
      block: "D1",
      aisle: "D01",
      tier: "T01",
      capacityPallet: 1,
      currentPalletCount: 0,
      status: "Active",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const tasks: WarehouseTask[] = [
    {
      id: "task-open",
      taskNo: "MOVE-0001",
      taskType: "MOVE",
      status: "Open",
      printCount: 0,
      priority: "Normal",
      createdBy: "demo",
      createdAt: now,
    },
    {
      id: "task-confirmed",
      taskNo: "MOVE-0002",
      taskType: "MOVE",
      status: "Confirmed",
      printCount: 0,
      priority: "Normal",
      createdBy: "demo",
      createdAt: now,
    },
  ];

  const taskLines: WarehouseTaskLine[] = [
    {
      id: "line-a",
      taskId: "task-open",
      taskNo: "MOVE-0001",
      lineNo: 1,
      palletId: "PALLET-001",
      skuCode: "SKU-1",
      skuName: "SKU 1",
      batchNo: "BATCH-1",
      qty: 1,
      uom: "EA",
      weight: 1,
      fromLocation: "BIN-X",
      toLocation: "BIN-A",
      actualLocation: null,
      status: "Open",
    },
    {
      id: "line-b",
      taskId: "task-open",
      taskNo: "MOVE-0001",
      lineNo: 2,
      palletId: "PALLET-002",
      skuCode: "SKU-1",
      skuName: "SKU 1",
      batchNo: "BATCH-1",
      qty: 1,
      uom: "EA",
      weight: 1,
      fromLocation: "BIN-X",
      toLocation: "BIN-B",
      actualLocation: null,
      status: "Open",
    },
    {
      id: "line-c",
      taskId: "task-confirmed",
      taskNo: "MOVE-0002",
      lineNo: 1,
      palletId: "PALLET-003",
      skuCode: "SKU-1",
      skuName: "SKU 1",
      batchNo: "BATCH-1",
      qty: 1,
      uom: "EA",
      weight: 1,
      fromLocation: "BIN-X",
      toLocation: "BIN-A",
      actualLocation: null,
      status: "Open",
    },
  ];

  setState((s) => ({
    ...s,
    locations,
    tasks,
    taskLines,
  }));
}

afterEach(() => {
  resetStore();
});

test("getMultiTargetBinCapacityByTaskType counts open MOVE lines and dedupes bins", () => {
  seedAllocationFixture();

  const rows = getMultiTargetBinCapacityByTaskType({
    locationCodes: ["BIN-A", "BIN-B", "BIN-A"],
    taskType: "MOVE",
  });

  assert.deepEqual(rows, [
    {
      locationCode: "BIN-A",
      capacityPallet: 5,
      currentPalletCount: 2,
      openTaskLineCount: 1,
      availableCapacity: 2,
    },
    {
      locationCode: "BIN-B",
      capacityPallet: 4,
      currentPalletCount: 1,
      openTaskLineCount: 1,
      availableCapacity: 2,
    },
  ]);
});

test("autoAllocatePalletsToBins fills earlier bins first while capacity remains", () => {
  seedAllocationFixture();

  const assignments = autoAllocatePalletsToBins({
    palletIds: ["PALLET-001", "PALLET-002", "PALLET-003"],
    targetLocations: ["BIN-A", "BIN-B"],
    taskType: "MOVE",
  });

  assert.deepEqual(assignments, [
    { palletId: "PALLET-001", targetLocation: "BIN-A" },
    { palletId: "PALLET-002", targetLocation: "BIN-A" },
    { palletId: "PALLET-003", targetLocation: "BIN-B" },
  ]);
});

test("autoAllocatePalletsToBins rejects requests when total capacity is insufficient", () => {
  seedAllocationFixture();

  assert.throws(
    () =>
      autoAllocatePalletsToBins({
        palletIds: ["PALLET-001", "PALLET-002", "PALLET-003", "PALLET-004", "PALLET-005"],
        targetLocations: ["BIN-A", "BIN-B"],
        taskType: "MOVE",
      }),
    /Tổng capacity không đủ/,
  );
});
