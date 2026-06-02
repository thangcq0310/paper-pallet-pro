import type { UserRole } from "@/types";

export interface MobileScanSettings {
  operatorName: string;
  role: UserRole;
  allowOpenTaskConfirm: boolean;
  allowActualLocationOverride: boolean;
}

const STORAGE_KEY = "mini-wms-mobile-scan-settings-v1";

export function getDefaultMobileScanSettings(): MobileScanSettings {
  return {
    operatorName: "demo",
    role: "Operator",
    allowOpenTaskConfirm: false,
    allowActualLocationOverride: false,
  };
}

function normalizeMobileScanSettings(input: Partial<MobileScanSettings>): MobileScanSettings {
  const role = input.role === "Supervisor" || input.role === "Admin" ? input.role : "Operator";
  const allowOpenTaskConfirm = Boolean(input.allowOpenTaskConfirm);
  const allowActualLocationOverride = role === "Operator" ? false : Boolean(input.allowActualLocationOverride);

  return {
    operatorName: input.operatorName?.trim() || "demo",
    role,
    allowOpenTaskConfirm: role === "Operator" ? false : allowOpenTaskConfirm,
    allowActualLocationOverride,
  };
}

export function loadMobileScanSettings(): MobileScanSettings {
  if (typeof window === "undefined") return getDefaultMobileScanSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultMobileScanSettings();
    const parsed = JSON.parse(raw) as Partial<MobileScanSettings>;
    return normalizeMobileScanSettings(parsed);
  } catch {
    return getDefaultMobileScanSettings();
  }
}

export function saveMobileScanSettings(settings: MobileScanSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMobileScanSettings(settings)));
}
