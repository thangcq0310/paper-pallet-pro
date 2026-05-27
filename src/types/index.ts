export interface SKU {
  id: string;
  skuCode: string;
  skuName: string;
  uom: string;
  weightPerUnit: number;
  storageType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  batchNo: string;
  skuCode: string;
  mfgDate: string;
  expDate: string;
  createdAt: string;
  updatedAt: string;
}

export type LocationStatus = "Active" | "Blocked";

export interface Location {
  id: string;
  locationCode: string;
  zone: string;
  block: string;
  capacityPallet: number;
  currentPalletCount: number;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
}

export type PalletStatus =
  | "Label Created"
  | "Labeled"
  | "In Stock"
  | "Staged"
  | "Loaded"
  | "Shipped";

export interface Pallet {
  id: string;
  palletId: string;
  skuCode: string;
  skuName: string;
  batchNo: string;
  qty: number;
  uom: string;
  weight: number;
  mfgDate: string;
  expDate: string;
  currentLocation: string;
  status: PalletStatus;
  labelAttached: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | "LABEL_CREATED"
  | "LABEL_ATTACHED"
  | "IN"
  | "PUT"
  | "MOVE"
  | "PICK"
  | "STAGE"
  | "LOAD"
  | "OUT"
  | "ADJ";

export interface Movement {
  id: string;
  movementId: string;
  movementType: MovementType;
  palletId: string;
  skuCode: string;
  batchNo: string;
  qty: number;
  weight: number;
  fromLocation: string | null;
  toLocation: string | null;
  user: string;
  timestamp: string;
  note?: string;
}

export type TaskType = "PUTAWAY" | "MOVE" | "PICK" | "LOAD";
export type TaskStatus = "Open" | "In Progress" | "Confirmed" | "Cancelled";
export type TaskPriority = "Low" | "Normal" | "High" | "Urgent";

export interface WarehouseTask {
  id: string;
  taskNo: string;
  taskType: TaskType;
  palletId: string;
  fromLocation: string;
  toLocation: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  note?: string;
}

export interface OutboundDocument {
  id: string;
  outboundNo: string;
  destination: string;
  skuCode: string;
  requiredQty: number;
  selectedPalletIds: string[];
  status: "Draft" | "Picking" | "Staged" | "Loaded" | "Shipped" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}
