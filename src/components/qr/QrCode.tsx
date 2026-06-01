import { useMemo } from "react";
import { buildQrSvg } from "@/utils/qr";
import { cn } from "@/lib/utils";

export function QrCode({
  value,
  className,
  margin = 4,
}: {
  value: string;
  className?: string;
  margin?: number;
}) {
  const svg = useMemo(() => buildQrSvg(value, { margin }), [margin, value]);

  return (
    <div
      className={cn("overflow-hidden rounded-md bg-white", className)}
      aria-label={`QR code for ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
