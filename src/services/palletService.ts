import { getState, setState } from "./store";
import { generatePalletId, uid } from "@/utils/idGenerator";
import { recordMovement } from "./movementService";
import type { Pallet } from "@/types";

export function listPallets() { return getState().pallets; }
export function getPallet(palletId: string) { return getState().pallets.find((p) => p.palletId === palletId); }

export function createPalletLabel(input: {
  receivingLocation: string;
  skuCode: string; batchNo: string; qty: number; uom: string; weight: number;
  mfgDate: string; expDate: string; note?: string;
}): Pallet {
  const s = getState();
  const sku = s.skus.find((x) => x.skuCode === input.skuCode);
  if (!sku) throw new Error("SKU không tồn tại");
  const batch = s.batches.find((b) => b.batchNo === input.batchNo && b.skuCode === input.skuCode);
  if (!batch) throw new Error("Batch không tồn tại cho SKU này");
  const palletId = generatePalletId(s.pallets.map((p) => p.palletId));
  const now = new Date().toISOString();
  const rcvLoc = s.locations.find((l) => l.locationCode === input.receivingLocation);
  if (!rcvLoc) throw new Error("Receiving location không tồn tại");
  if (rcvLoc.status === "Blocked") throw new Error("Receiving location đang Blocked");
  if (rcvLoc.locationType !== "RECEIVING") throw new Error("Location phải thuộc loại RECEIVING");
  if (rcvLoc.currentPalletCount >= rcvLoc.capacityPallet) throw new Error("Receiving location đã đầy");

  const pallet: Pallet = {
    id: uid(),
    palletId,
    skuCode: input.skuCode,
    skuName: sku.skuName,
    batchNo: input.batchNo,
    qty: input.qty,
    uom: input.uom,
    weight: input.weight,
    mfgDate: input.mfgDate,
    expDate: input.expDate,
    currentLocation: input.receivingLocation,
    status: "Label Created",
    labelAttached: false,
    createdAt: now,
    updatedAt: now,
  };
  setState((st) => ({
    ...st,
    pallets: [pallet, ...st.pallets],
    locations: st.locations.map((l) => l.locationCode === input.receivingLocation ? { ...l, currentPalletCount: l.currentPalletCount + 1 } : l),
  }));
  recordMovement({ type: "LABEL_CREATED", pallet, fromLocation: null, toLocation: input.receivingLocation, note: input.note });
  recordMovement({ type: "IN", pallet, fromLocation: null, toLocation: input.receivingLocation });
  return pallet;
}

export function confirmLabelAttached(palletId: string) {
  const p = getPallet(palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  if (p.status === "Shipped") throw new Error("Pallet đã Shipped");
  if (p.labelAttached) throw new Error("Pallet đã được xác nhận dán nhãn");
  const updated: Pallet = { ...p, labelAttached: true, status: "Labeled", updatedAt: new Date().toISOString() };
  setState((s) => ({ ...s, pallets: s.pallets.map((x) => x.id === p.id ? updated : x) }));
  recordMovement({ type: "LABEL_ATTACHED", pallet: updated, fromLocation: updated.currentLocation, toLocation: updated.currentLocation });
  return updated;
}

function validateTargetLocation(code: string) {
  const loc = getState().locations.find((l) => l.locationCode === code);
  if (!loc) throw new Error("Location không tồn tại");
  if (loc.status === "Blocked") throw new Error("Location đang Blocked");
  if (loc.currentPalletCount >= loc.capacityPallet) throw new Error("Location đã đầy");
  return loc;
}

export function putawayPallet(palletId: string, toLocation: string, note?: string) {
  const p = getPallet(palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  if (!p.labelAttached) throw new Error("Pallet chưa xác nhận dán nhãn");
  if (p.status !== "Labeled") throw new Error("Pallet không ở trạng thái Labeled");
  validateTargetLocation(toLocation);
  const from = p.currentLocation;
  const updated: Pallet = { ...p, currentLocation: toLocation, status: "In Stock", updatedAt: new Date().toISOString() };
  setState((s) => ({
    ...s,
    pallets: s.pallets.map((x) => x.id === p.id ? updated : x),
    locations: s.locations.map((l) => {
      if (l.locationCode === from) return { ...l, currentPalletCount: Math.max(0, l.currentPalletCount - 1) };
      if (l.locationCode === toLocation) return { ...l, currentPalletCount: l.currentPalletCount + 1 };
      return l;
    }),
  }));
  recordMovement({ type: "PUT", pallet: updated, fromLocation: from, toLocation, note });
  return updated;
}

export function movePallet(palletId: string, toLocation: string, note?: string) {
  const p = getPallet(palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  if (p.status === "Shipped") throw new Error("Pallet đã Shipped");
  if (p.status !== "In Stock" && p.status !== "Staged") throw new Error("Chỉ chuyển pallet đang In Stock hoặc Staged");
  if (p.currentLocation === toLocation) throw new Error("Đã ở location này rồi");
  const loc = validateTargetLocation(toLocation);
  if (loc.locationType === "RECEIVING" || loc.locationType === "DOCK") {
    throw new Error("Không thể Move pallet tới khu vực RECEIVING hoặc DOCK");
  }
  const from = p.currentLocation;
  const nextStatus =
    loc.locationType === "STAGING" ? "Staged"
      : p.status === "Staged" ? "In Stock"
        : p.status;
  const updated: Pallet = { ...p, currentLocation: toLocation, status: nextStatus, updatedAt: new Date().toISOString() };
  setState((s) => ({
    ...s,
    pallets: s.pallets.map((x) => x.id === p.id ? updated : x),
    locations: s.locations.map((l) => {
      if (l.locationCode === from) return { ...l, currentPalletCount: Math.max(0, l.currentPalletCount - 1) };
      if (l.locationCode === toLocation) return { ...l, currentPalletCount: l.currentPalletCount + 1 };
      return l;
    }),
  }));
  recordMovement({ type: "MOVE", pallet: updated, fromLocation: from, toLocation, note });
  return updated;
}

export function pickAndShipPallet(palletId: string, note?: string) {
  const p = getPallet(palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  if (p.status !== "In Stock" && p.status !== "Staged") {
    throw new Error("Chỉ được pick pallet đang In Stock hoặc Staged");
  }
  const from = p.currentLocation;
  const updated: Pallet = { ...p, currentLocation: null, lastLocation: from || undefined, status: "Shipped", updatedAt: new Date().toISOString() };
  setState((s) => ({
    ...s,
    pallets: s.pallets.map((x) => x.id === p.id ? updated : x),
    locations: s.locations.map((l) => l.locationCode === from ? { ...l, currentPalletCount: Math.max(0, l.currentPalletCount - 1) } : l),
  }));
  recordMovement({ type: "PICK", pallet: updated, fromLocation: from, toLocation: null, note });
  recordMovement({ type: "OUT", pallet: updated, fromLocation: from, toLocation: null, note });
  return updated;
}

// FEFO/FIFO suggest
export function suggestPalletsForOutbound(skuCode: string, requiredQty: number) {
  const pallets = getState().pallets
    .filter((p) => p.skuCode === skuCode && p.status === "In Stock")
    .sort((a, b) => {
      const ea = new Date(a.expDate).getTime();
      const eb = new Date(b.expDate).getTime();
      if (ea !== eb) return ea - eb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  const selected: typeof pallets = [];
  let sum = 0;
  for (const p of pallets) {
    if (sum >= requiredQty) break;
    selected.push(p);
    sum += p.qty;
  }
  return { suggested: pallets, selected, fulfilled: sum };
}
