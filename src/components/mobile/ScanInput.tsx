import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { parseScannedCode } from "@/utils/scan";
import { Camera, CameraOff, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};

export function ScanInput({
  label,
  placeholder = "Nhập hoặc scan code",
  hint,
  className,
  onScan,
}: {
  label: string;
  placeholder?: string;
  hint?: string;
  className?: string;
  onScan: (rawValue: string, parsed: ReturnType<typeof parseScannedCode>) => void;
}) {
  const [value, setValue] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraSupported, setCameraSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const busyRef = useRef(false);

  const stopCamera = () => {
    setCameraOn(false);
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    setCameraSupported(Boolean((window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector) && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    if (!cameraOn) return undefined;

    let cancelled = false;

    const start = async () => {
      try {
        setCameraError("");
        const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
        if (!BarcodeDetectorCtor) throw new Error("Thiết bị không hỗ trợ BarcodeDetector");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        detectorRef.current = new BarcodeDetectorCtor({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"],
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const loop = async () => {
          if (cancelled || !cameraOn || busyRef.current || !videoRef.current || !detectorRef.current) return;
          busyRef.current = true;
          try {
            const detected = await detectorRef.current.detect(videoRef.current);
            const rawValue = detected[0]?.rawValue?.trim();
            if (rawValue) {
              handleRawValue(rawValue);
              stopCamera();
              return;
            }
          } catch (error: any) {
            setCameraError(error?.message ?? "Camera scan thất bại");
            stopCamera();
            return;
          } finally {
            busyRef.current = false;
          }
          rafRef.current = window.requestAnimationFrame(loop);
        };
        rafRef.current = window.requestAnimationFrame(loop);
      } catch (error: any) {
        setCameraError(error?.message ?? "Không mở được camera");
        stopCamera();
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  const handleRawValue = (rawValue: string) => {
    const parsed = parseScannedCode(rawValue);
    onScan(rawValue, parsed);
    setValue("");
  };

  return (
    <Card className={cn("rounded-3xl border-2 border-border/60 bg-card/95 shadow-sm", className)}>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>

        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-12 text-base font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (value.trim()) handleRawValue(value);
              }
            }}
          />
          <Button
            className="h-12 min-w-12 px-4"
            onClick={() => {
              if (value.trim()) handleRawValue(value);
            }}
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={cameraOn ? "default" : "outline"}
            className="h-12 flex-1"
            onClick={() => {
              setCameraError("");
              if (cameraOn) stopCamera();
              else setCameraOn(true);
            }}
            disabled={!cameraSupported && !cameraOn}
          >
            {cameraOn ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
            {cameraOn ? "Dừng camera" : "Mở camera"}
          </Button>
        </div>

        {cameraError && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{cameraError}</div>}
        {!cameraSupported && <div className="text-xs text-muted-foreground">Thiết bị này chưa hỗ trợ camera scan, dùng nhập tay.</div>}

        <video
          ref={videoRef}
          className={cn("hidden w-full rounded-2xl bg-black", cameraOn ? "block aspect-video" : "hidden")}
          playsInline
          muted
        />
      </CardContent>
    </Card>
  );
}
