export interface MobileScanSettings {
  operatorName: string;
  allowOpenTaskConfirm: boolean;
  allowActualLocationOverride: boolean;
}

const STORAGE_KEY = "mini-wms-mobile-scan-settings-v1";

export function getDefaultMobileScanSettings(): MobileScanSettings {
  return {
    operatorName: "demo",
    allowOpenTaskConfirm: false,
    allowActualLocationOverride: false,
  };
}

export function loadMobileScanSettings(): MobileScanSettings {
  if (typeof window === "undefined") return getDefaultMobileScanSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultMobileScanSettings();
    const parsed = JSON.parse(raw) as Partial<MobileScanSettings>;
    return {
      operatorName: parsed.operatorName?.trim() || "demo",
      allowOpenTaskConfirm: Boolean(parsed.allowOpenTaskConfirm),
      allowActualLocationOverride: Boolean(parsed.allowActualLocationOverride),
    };
  } catch {
    return getDefaultMobileScanSettings();
  }
}

export function saveMobileScanSettings(settings: MobileScanSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
