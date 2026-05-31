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
export type LocationType = "RECEIVING" | "STORAGE" | "STAGING" | "DOCK";

export interface Location {
  id: string;
  locationCode: string;
  locationName?: string;
  locationType: LocationType;
  zone: string;
  block: string;
  capacityPallet: number;
  currentPalletCount: number;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
}

export type PalletStatus =
  | "Pending Putaway"
  | "In Stock"
  | "Staged"
  | "Shipped"
  | "Cancelled";

export interface Pallet {
  id: string;
  palletId: string;
  referenceDocumentNo?: string;
  referenceLineNo?: string;
  sourceSystem?: string;
  skuCode: string;
  skuName: string;
  batchNo: string;
  qty: number;
  uom: string;
  weight: number;
  mfgDate: string;
  expDate: string;
  currentLocation: string | null;
  lastLocation?: string;
  status: PalletStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | "LABEL_CREATED"
  | "LABEL_ATTACHED"
  | "LABEL_CANCELLED"
  | "IN"
  | "PUT"
  | "MOVE"
  | "PICK"
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

export type TaskType = "PUTAWAY" | "MOVE" | "PICK" | "ADJUST" | "COUNT";
export type TaskStatus = "Open" | "Printed" | "In Progress" | "Confirmed" | "Cancelled";
export type TaskPriority = "Low" | "Normal" | "High" | "Urgent";

export interface WarehouseTask {
  id: string;
  taskNo: string;
  taskType: TaskType;
  inboundNo?: string;
  outboundNo?: string;
  palletId: string;
  skuCode: string;
  skuName: string;
  batchNo: string;
  qty: number;
  uom: string;
  weight: number;
  fromLocation: string;
  toLocation: string;
  actualLocation?: string;
  status: TaskStatus;
  printCount: number;
  printedAt?: string;
  printedBy?: string;
  priority: TaskPriority;
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  instruction?: string;
  note?: string;
}

export interface OutboundDocument {
  id: string;
  outboundNo: string;
  destination: string;
  skuCode: string;
  requiredQty: number;
  selectedPalletIds: string[];
  status: "Draft" | "Picking" | "Staged" | "Shipped" | "Cancelled";
  createdAt: string;
  updatedAt: string;
}
