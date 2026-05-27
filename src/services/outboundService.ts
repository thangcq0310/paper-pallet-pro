import { getState, setState } from "./store";
import { generateOutboundNo, uid } from "@/utils/idGenerator";
import type { OutboundDocument } from "@/types";

export function listOutbounds() { return getState().outbounds; }

export function createOutbound(input: { destination: string; skuCode: string; requiredQty: number; selectedPalletIds: string[] }): OutboundDocument {
  const outboundNo = generateOutboundNo(getState().outbounds.map((o) => o.outboundNo));
  const now = new Date().toISOString();
  const doc: OutboundDocument = {
    id: uid(),
    outboundNo,
    destination: input.destination,
    skuCode: input.skuCode,
    requiredQty: input.requiredQty,
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
