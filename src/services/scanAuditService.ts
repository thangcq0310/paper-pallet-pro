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

export function exportScanEvents(format: "csv" | "json" = "csv") {
  const events = [...getState().scanEvents].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));

  if (format === "json") {
    return {
      fileName: `scan-log-${new Date().toISOString().slice(0, 10)}.json`,
      mimeType: "application/json;charset=utf-8",
      content: JSON.stringify(events, null, 2),
    };
  }

  const headers = [
    "id",
    "scannedAt",
    "scanType",
    "scannedValue",
    "parsedType",
    "parsedCode",
    "taskNo",
    "palletId",
    "locationCode",
    "result",
    "message",
    "scannedBy",
  ];
  const escapeCsv = (value: unknown) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  const rows = events.map((event) => [
    event.id,
    event.scannedAt,
    event.scanType,
    event.scannedValue,
    event.parsedType,
    event.parsedCode ?? "",
    event.taskNo ?? "",
    event.palletId ?? "",
    event.locationCode ?? "",
    event.result,
    event.message,
    event.scannedBy,
  ]);

  return {
    fileName: `scan-log-${new Date().toISOString().slice(0, 10)}.csv`,
    mimeType: "text/csv;charset=utf-8",
    content: [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n"),
  };
}
