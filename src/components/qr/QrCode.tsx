import { useEffect, useState } from "react";
import { buildQrSvg } from "@/utils/qr";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function QrCode({
  value,
  className,
  margin = 4,
}: {
  value: string;
  className?: string;
  margin?: number;
}) {
  const [svg, setSvg] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSvg("");
    let cancelled = false;
    buildQrSvg(value, { margin })
      .then((s) => {
        if (!cancelled) {
          setSvg(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [margin, value]);

  return (
    <div
      className={cn("overflow-hidden rounded-md bg-white flex items-center justify-center", className)}
      aria-label={`QR code for ${value}`}
    >
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      ) : svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} className="w-full h-full [&>svg]:w-full [&>svg]:h-full" />
      ) : null}
    </div>
  );
}
