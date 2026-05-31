import { getState, setState } from "./store";
import { generatePalletId, uid } from "@/utils/idGenerator";
import { recordMovement } from "./movementService";
import type { Pallet } from "@/types";

export function listPallets() { return getState().pallets; }
export function getPallet(palletId: string) { return getState().pallets.find((p) => p.palletId === palletId); }

export function createPallets(inputs: {
  inboundNo?: string;
  receivingLocation: string;
  skuCode: string; batchNo: string; qty: number; uom: string; weight: number;
  mfgDate: string; expDate: string; note?: string;
}[]): Pallet[] {
  const s = getState();
  const now = new Date().toISOString();
  
  const newPallets: Pallet[] = [];
  const locationUpdates: Record<string, number> = {};

  // First we need to calculate starting sequence for IDs to avoid collision during map
  let currentExisting = s.pallets.map(p => p.palletId);
  
  for (const input of inputs) {
    const sku = s.skus.find((x) => x.skuCode === input.skuCode);
    if (!sku) throw new Error(`SKU ${input.skuCode} không tồn tại`);
    const batch = s.batches.find((b) => b.batchNo === input.batchNo && b.skuCode === input.skuCode);
    if (!batch) throw new Error(`Batch ${input.batchNo} không tồn tại cho SKU ${input.skuCode}`);
    
    const rcvLoc = s.locations.find((l) => l.locationCode === input.receivingLocation);
    if (!rcvLoc) throw new Error(`Receiving location ${input.receivingLocation} không tồn tại`);
    if (rcvLoc.status === "Blocked") throw new Error(`Receiving location ${input.receivingLocation} đang Blocked`);
    if (rcvLoc.locationType !== "RECEIVING") throw new Error("Location phải thuộc loại RECEIVING");
    
    const addedCount = locationUpdates[input.receivingLocation] || 0;
    if (rcvLoc.currentPalletCount + addedCount >= rcvLoc.capacityPallet) {
      throw new Error(`Receiving location ${input.receivingLocation} đã đầy`);
    }

    const palletId = generatePalletId(currentExisting);
    currentExisting.push(palletId);

    const pallet: Pallet = {
      id: uid(),
      palletId,
      inboundNo: input.inboundNo,
      skuCode: input.skuCode,
      skuName: sku.skuName,
      batchNo: input.batchNo,
      qty: input.qty,
      uom: input.uom,
      weight: input.weight,
      mfgDate: input.mfgDate,
      expDate: input.expDate,
      currentLocation: input.receivingLocation,
      status: "Pending Putaway",
      createdAt: now,
      updatedAt: now,
    };

    newPallets.push(pallet);
    locationUpdates[input.receivingLocation] = addedCount + 1;
  }

  setState((st) => ({
    ...st,
    pallets: [...newPallets, ...st.pallets],
    locations: st.locations.map((l) => 
      locationUpdates[l.locationCode] 
        ? { ...l, currentPalletCount: l.currentPalletCount + locationUpdates[l.locationCode] } 
        : l
    ),
  }));

  for (const pallet of newPallets) {
    recordMovement({ type: "IN", pallet, fromLocation: null, toLocation: pallet.currentLocation });
  }

  return newPallets;
}

export function cancelPallet(palletId: string) {
  const p = getPallet(palletId);
  if (!p) throw new Error("Pallet không tồn tại");
  if (p.status !== "Pending Putaway") throw new Error("Chỉ có thể hủy pallet đang ở trạng thái Pending Putaway");

  const s = getState();
  const tasks = s.tasks.filter(t => t.palletId === palletId && (t.status === "Open" || t.status === "Printed" || t.status === "In Progress"));
  if (tasks.length > 0) {
    throw new Error("Không thể hủy pallet đang có Task hoạt động. Vui lòng hủy Task trước.");
  }

  const updated: Pallet = { ...p, status: "Cancelled", currentLocation: null, updatedAt: new Date().toISOString() };
  
  setState((st) => ({
    ...st,
    pallets: st.pallets.map((x) => x.id === p.id ? updated : x),
    locations: st.locations.map((l) => 
      l.locationCode === p.currentLocation 
        ? { ...l, currentPalletCount: Math.max(0, l.currentPalletCount - 1) } 
        : l
    ),
  }));

  recordMovement({ type: "OUT", pallet: updated, fromLocation: p.currentLocation, toLocation: null, note: "Cancelled unused pallet" });
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
  if (p.status !== "Pending Putaway") throw new Error("Pallet không ở trạng thái Pending Putaway");
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
