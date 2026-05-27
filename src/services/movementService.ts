import { getState, setState } from "./store";
import { generateMovementId, uid } from "@/utils/idGenerator";
import type { Movement, MovementType, Pallet } from "@/types";

export function recordMovement(args: {
  type: MovementType;
  pallet: Pallet;
  fromLocation: string | null;
  toLocation: string | null;
  note?: string;
  user?: string;
}): Movement {
  const movementId = generateMovementId(getState().movements.map((m) => m.movementId));
  const mv: Movement = {
    id: uid(),
    movementId,
    movementType: args.type,
    palletId: args.pallet.palletId,
    skuCode: args.pallet.skuCode,
    batchNo: args.pallet.batchNo,
    qty: args.pallet.qty,
    weight: args.pallet.weight,
    fromLocation: args.fromLocation,
    toLocation: args.toLocation,
    user: args.user ?? "demo",
    timestamp: new Date().toISOString(),
    note: args.note,
  };
  setState((s) => ({ ...s, movements: [mv, ...s.movements] }));
  return mv;
}

export function listMovements() { return getState().movements; }
