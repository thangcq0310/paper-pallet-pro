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
