import { getState } from "@/services/store";
import type { ParsedScanType } from "@/types";

export interface ParsedScannedCode {
  rawValue: string;
  normalizedValue: string;
  parsedType: ParsedScanType;
  parsedCode: string | null;
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLookup(value: string) {
  return normalize(value).toUpperCase();
}

function findCanonicalCode<T>(items: T[], key: keyof T, value: string) {
  const lookup = normalizeLookup(value);
  return items.find((item) => normalizeLookup(String((item as any)[key])) === lookup) ?? null;
}

function getCanonicalCode(value: string, codes: string[]) {
  const lookup = normalizeLookup(value);
  return codes.find((code) => normalizeLookup(code) === lookup) ?? null;
}

export function makeScanCode(prefix: "PLT" | "LOC" | "TASK", code: string) {
  return `${prefix}:${code.trim()}`;
}

export function parseScannedCode(value: string): ParsedScannedCode {
  const rawValue = normalize(value);
  if (!rawValue) {
    return { rawValue: "", normalizedValue: "", parsedType: "UNKNOWN", parsedCode: null };
  }

  const prefixed = rawValue.match(/^(PLT|LOC|TASK)\s*:\s*(.+)$/i);
  const state = getState();

  if (prefixed) {
    const prefix = prefixed[1].toUpperCase();
    const code = normalize(prefixed[2]);
    if (!code) {
      return { rawValue, normalizedValue: rawValue, parsedType: "UNKNOWN", parsedCode: null };
    }

    if (prefix === "PLT") {
      const pallet = findCanonicalCode(state.pallets, "palletId", code);
      return { rawValue, normalizedValue: rawValue, parsedType: "PALLET", parsedCode: pallet?.palletId ?? code };
    }

    if (prefix === "LOC") {
      const location = findCanonicalCode(state.locations, "locationCode", code);
      return { rawValue, normalizedValue: rawValue, parsedType: "LOCATION", parsedCode: location?.locationCode ?? code };
    }

    const task = findCanonicalCode(state.tasks, "taskNo", code);
    return { rawValue, normalizedValue: rawValue, parsedType: "TASK", parsedCode: task?.taskNo ?? code };
  }

  const pallet = getCanonicalCode(rawValue, state.pallets.map((p) => p.palletId));
  if (pallet) {
    return { rawValue, normalizedValue: rawValue, parsedType: "PALLET", parsedCode: pallet };
  }

  const location = getCanonicalCode(rawValue, state.locations.map((l) => l.locationCode));
  if (location) {
    return { rawValue, normalizedValue: rawValue, parsedType: "LOCATION", parsedCode: location };
  }

  const task = getCanonicalCode(rawValue, state.tasks.map((t) => t.taskNo));
  if (task) {
    return { rawValue, normalizedValue: rawValue, parsedType: "TASK", parsedCode: task };
  }

  return { rawValue, normalizedValue: rawValue, parsedType: "UNKNOWN", parsedCode: null };
}
