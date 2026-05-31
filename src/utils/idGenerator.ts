export function generatePalletId(existing: string[]): string {
  return generatePalletIds(existing, 1)[0];
}

export function generatePalletIds(existing: string[], count: number): string[] {
  if (count <= 0) return [];
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `PLT-${ymd}-`;
  
  const max = existing
    .filter((p) => p.startsWith(prefix))
    .map((p) => parseInt(p.slice(prefix.length), 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);

  return Array.from({ length: count }, (_, i) => `${prefix}${String(max + 1 + i).padStart(4, "0")}`);
}

export function generateMovementId(existing: string[]): string {
  const nums = existing.map((m) => parseInt(m.replace("MV-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.reduce((a, b) => Math.max(a, b), 0);
  return `MV-${String(max + 1).padStart(4, "0")}`;
}

export function generateTaskNo(existing: string[]): string {
  const nums = existing.map((m) => parseInt(m.replace("TASK-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.reduce((a, b) => Math.max(a, b), 0);
  return `TASK-${String(max + 1).padStart(4, "0")}`;
}

export function generateOutboundNo(existing: string[]): string {
  const nums = existing.map((m) => parseInt(m.replace("OUT-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.reduce((a, b) => Math.max(a, b), 0);
  return `OUT-${String(max + 1).padStart(4, "0")}`;
}

export const uid = () => Math.random().toString(36).slice(2, 11);
