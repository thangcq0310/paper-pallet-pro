import { getState, setState } from "./store";
import { uid } from "@/utils/idGenerator";
import type { Batch, Location, SKU } from "@/types";
import { detectDelimiter, parseCsv } from "@/utils/csv";

export interface BulkImportError {
  row: number; // 1-based, including header row = 1
  message: string;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: BulkImportError[];
}

function normalizeHeader(h: string) {
  return h.trim().replaceAll("\uFEFF", "");
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function assertNonEmpty(value: string, field: string) {
  if (!value?.trim()) throw new Error(`${field} bắt buộc`);
  return value.trim();
}

function parseTable(text: string): { header: string[]; rows: string[][] } {
  const delimiter = detectDelimiter(text);
  const table = parseCsv(text, delimiter);
  if (table.length === 0) throw new Error("File rỗng");
  const header = (table[0] ?? []).map(normalizeHeader);
  const rows = table.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  return { header, rows };
}

function mapRow(header: string[], row: string[]) {
  const obj: Record<string, string> = {};
  header.forEach((h, idx) => {
    obj[h] = (row[idx] ?? "").trim();
  });
  return obj;
}

export function importSkusFromCsv(text: string): BulkImportResult {
  const { header, rows } = parseTable(text);
  const required = ["skuCode", "skuName", "uom", "weightPerUnit", "storageType"];
  for (const h of required) {
    if (!header.includes(h)) throw new Error(`Thiếu cột ${h}`);
  }

  const s = getState();
  const byCode = new Map(s.skus.map((x) => [x.skuCode, x]));
  const now = new Date().toISOString();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: BulkImportError[] = [];

  const next = [...s.skus];

  rows.forEach((r, idx) => {
    const rowNo = idx + 2;
    try {
      const o = mapRow(header, r);
      const skuCode = assertNonEmpty(o.skuCode, "skuCode");
      const skuName = assertNonEmpty(o.skuName, "skuName");
      const uom = assertNonEmpty(o.uom, "uom");
      const weightPerUnit = toNumber(o.weightPerUnit);
      if (weightPerUnit === null || weightPerUnit < 0) throw new Error("weightPerUnit không hợp lệ");
      const storageType = (o.storageType || "Dry").trim();
      if (!["Dry", "Frozen", "Chilled"].includes(storageType)) throw new Error("storageType phải là Dry/Frozen/Chilled");

      const existing = byCode.get(skuCode);
      if (existing) {
        const patched: SKU = { ...existing, skuName, uom, weightPerUnit, storageType, updatedAt: now };
        const i = next.findIndex((x) => x.id === existing.id);
        if (i >= 0) next[i] = patched;
        updated += 1;
      } else {
        const sku: SKU = { id: uid(), skuCode, skuName, uom, weightPerUnit, storageType, createdAt: now, updatedAt: now };
        next.unshift(sku);
        byCode.set(skuCode, sku);
        created += 1;
      }
    } catch (e: any) {
      errors.push({ row: rowNo, message: e?.message ?? String(e) });
      skipped += 1;
    }
  });

  if (created + updated > 0) {
    setState((st) => ({ ...st, skus: next }));
  }

  return { created, updated, skipped, errors };
}

export function importBatchesFromCsv(text: string): BulkImportResult {
  const { header, rows } = parseTable(text);
  const required = ["batchNo", "skuCode", "mfgDate", "expDate"];
  for (const h of required) {
    if (!header.includes(h)) throw new Error(`Thiếu cột ${h}`);
  }

  const s = getState();
  const skuSet = new Set(s.skus.map((x) => x.skuCode));
  const key = (b: Pick<Batch, "batchNo" | "skuCode">) => `${b.skuCode}__${b.batchNo}`;
  const byKey = new Map(s.batches.map((b) => [key(b), b]));
  const now = new Date().toISOString();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: BulkImportError[] = [];

  const next = [...s.batches];

  rows.forEach((r, idx) => {
    const rowNo = idx + 2;
    try {
      const o = mapRow(header, r);
      const batchNo = assertNonEmpty(o.batchNo, "batchNo");
      const skuCode = assertNonEmpty(o.skuCode, "skuCode");
      if (!skuSet.has(skuCode)) throw new Error(`SKU ${skuCode} không tồn tại`);
      const mfgDate = assertNonEmpty(o.mfgDate, "mfgDate");
      const expDate = assertNonEmpty(o.expDate, "expDate");

      const k = `${skuCode}__${batchNo}`;
      const existing = byKey.get(k);
      if (existing) {
        const patched: Batch = { ...existing, mfgDate, expDate, updatedAt: now };
        const i = next.findIndex((x) => x.id === existing.id);
        if (i >= 0) next[i] = patched;
        updated += 1;
      } else {
        const b: Batch = { id: uid(), batchNo, skuCode, mfgDate, expDate, createdAt: now, updatedAt: now };
        next.unshift(b);
        byKey.set(k, b);
        created += 1;
      }
    } catch (e: any) {
      errors.push({ row: rowNo, message: e?.message ?? String(e) });
      skipped += 1;
    }
  });

  if (created + updated > 0) {
    setState((st) => ({ ...st, batches: next }));
  }
  return { created, updated, skipped, errors };
}

export function importLocationsFromCsv(text: string): BulkImportResult {
  const { header, rows } = parseTable(text);
  const required = ["locationCode", "zone", "block", "locationType", "capacityPallet", "status"];
  for (const h of required) {
    if (!header.includes(h)) throw new Error(`Thiếu cột ${h}`);
  }

  const s = getState();
  const byCode = new Map(s.locations.map((l) => [l.locationCode, l]));
  const now = new Date().toISOString();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: BulkImportError[] = [];

  const next = [...s.locations];

  rows.forEach((r, idx) => {
    const rowNo = idx + 2;
    try {
      const o = mapRow(header, r);
      const locationCode = assertNonEmpty(o.locationCode, "locationCode");
      const zone = assertNonEmpty(o.zone, "zone");
      const block = (o.block ?? "").trim();
      const locationType = assertNonEmpty(o.locationType, "locationType");
      if (!["RECEIVING", "STORAGE", "STAGING", "DOCK"].includes(locationType)) {
        throw new Error("locationType phải là RECEIVING/STORAGE/STAGING/DOCK");
      }
      const capacityPallet = toNumber(o.capacityPallet);
      if (capacityPallet === null || capacityPallet <= 0) throw new Error("capacityPallet phải > 0");
      const status = assertNonEmpty(o.status, "status");
      if (!["Active", "Blocked"].includes(status)) throw new Error("status phải là Active/Blocked");

      const existing = byCode.get(locationCode);
      if (existing) {
        const patched: Location = {
          ...existing,
          zone,
          block,
          locationType: locationType as Location["locationType"],
          capacityPallet,
          status: status as Location["status"],
          updatedAt: now,
        };
        const i = next.findIndex((x) => x.id === existing.id);
        if (i >= 0) next[i] = patched;
        updated += 1;
      } else {
        const l: Location = {
          id: uid(),
          locationCode,
          zone,
          block,
          locationType: locationType as Location["locationType"],
          capacityPallet,
          currentPalletCount: 0,
          status: status as Location["status"],
          createdAt: now,
          updatedAt: now,
        };
        next.unshift(l);
        byCode.set(locationCode, l);
        created += 1;
      }
    } catch (e: any) {
      errors.push({ row: rowNo, message: e?.message ?? String(e) });
      skipped += 1;
    }
  });

  if (created + updated > 0) {
    setState((st) => ({ ...st, locations: next }));
  }
  return { created, updated, skipped, errors };
}

