import { getState, setState } from "./store";
import { generateOutboundNo, uid } from "@/utils/idGenerator";
import type { OutboundDocument } from "@/types";

export interface OutboundBatchEntry {
  skuCode: string;
  batchNo: string;
  requiredQty: number;
}

export function listOutbounds() { return getState().outbounds; }

export function createOutbound(input: {
  outboundNo?: string;
  destination: string;
  batches: OutboundBatchEntry[];
  selectedPalletIds: string[];
}): OutboundDocument {
  const outboundNo = generateOutboundNo(getState().outbounds.map((o) => o.outboundNo));
  const resolvedNo = input.outboundNo?.trim() || outboundNo;
  if (getState().outbounds.some((o) => o.outboundNo === resolvedNo)) throw new Error(`Outbound No ${resolvedNo} đã tồn tại`);
  if (!input.batches.length) throw new Error("Thiếu batch để tạo outbound");
  if (!input.destination.trim()) throw new Error("Thiếu destination");
  const now = new Date().toISOString();
  const doc: OutboundDocument = {
    id: uid(),
    outboundNo: resolvedNo,
    destination: input.destination,
    skuCode: input.batches.map((b) => b.skuCode).join(", "),
    batchNo: input.batches.map((b) => b.batchNo).join(", "),
    requiredQty: input.batches.reduce((sum, b) => sum + b.requiredQty, 0),
    selectedPalletIds: input.selectedPalletIds,
    status: "Draft",
    createdAt: now,
    updatedAt: now,
  };
  setState((s) => ({ ...s, outbounds: [doc, ...s.outbounds] }));
  return doc;
}

export function updateOutboundStatus(id: string, status: OutboundDocument["status"]) {
  setState((s) => ({ ...s, outbounds: s.outbounds.map((o) => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o) }));
}

export function syncOutboundStatusByNo(outboundNo: string) {
  const doc = getState().outbounds.find((o) => o.outboundNo === outboundNo);
  if (!doc) return;
  const related = getState().tasks.filter((t) => t.outboundNo === outboundNo && t.taskType === "PICK");
  if (related.length === 0) return;

  const allConfirmed = related.every((t) => t.status === "Confirmed");
  const allCancelled = related.every((t) => t.status === "Cancelled");

  if (allConfirmed) updateOutboundStatus(doc.id, "Shipped");
  else if (allCancelled) updateOutboundStatus(doc.id, "Cancelled");
  else if (doc.status === "Draft") updateOutboundStatus(doc.id, "Picking");
}
