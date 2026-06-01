import { getState, setState } from "./store";
import { uid } from "@/utils/idGenerator";
import type { ParsedScanType, ScanEvent, ScanResult } from "@/types";

export function listScanEvents() {
  return getState().scanEvents;
}

export function appendScanEvent(input: Omit<ScanEvent, "id" | "scannedAt"> & { scannedAt?: string }) {
  const event: ScanEvent = {
    id: uid(),
    scannedAt: input.scannedAt ?? new Date().toISOString(),
    scanType: input.scanType,
    scannedValue: input.scannedValue,
    parsedType: input.parsedType,
    parsedCode: input.parsedCode,
    taskNo: input.taskNo,
    palletId: input.palletId,
    locationCode: input.locationCode,
    result: input.result,
    message: input.message,
    scannedBy: input.scannedBy,
  };

  setState((s) => ({ ...s, scanEvents: [event, ...s.scanEvents].slice(0, 200) }));
  return event;
}

export function makeScanOutcome(input: {
  scanType: string;
  scannedValue: string;
  parsedType: ParsedScanType;
  parsedCode: string | null;
  taskNo?: string | null;
  palletId?: string | null;
  locationCode?: string | null;
  result: ScanResult;
  message: string;
  scannedBy: string;
}) {
  return appendScanEvent({
    scanType: input.scanType,
    scannedValue: input.scannedValue,
    parsedType: input.parsedType,
    parsedCode: input.parsedCode,
    taskNo: input.taskNo ?? null,
    palletId: input.palletId ?? null,
    locationCode: input.locationCode ?? null,
    result: input.result,
    message: input.message,
    scannedBy: input.scannedBy,
  });
}
