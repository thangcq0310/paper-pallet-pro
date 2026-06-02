import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scan, Camera, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface SimpleScanInputProps {
  placeholder?: string;
  onScan: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Scanner types very fast (~10-30ms per char), humans type ~100-200ms per char
const SCAN_CHAR_INTERVAL_MS = 50;

const SCANNER_ID = "camera-scanner";

export function SimpleScanInput({ placeholder = "Quét mã...", onScan, disabled, autoFocus = true }: SimpleScanInputProps) {
  const [value, setValue] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTimeRef = useRef<number>(0);
  const scanBufferRef = useRef<string>("");
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setShowCamera(true);

    // Wait for DOM to update
    await new Promise(r => setTimeout(r, 200));

    if (!videoContainerRef.current) return;

    try {
      scannerRef.current = new Html5Qrcode(SCANNER_ID);
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 300, height: 300 },
        },
        (decodedText) => {
          onScan(decodedText);
          stopCamera();
        },
        () => {} // Ignore errors during scanning
      );
    } catch (err) {
      setCameraError("Không truy cập được camera. Vui lòng cho phép truy cập camera.");
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setShowCamera(false);
  };

  // Process scan buffer when typing stops
  const processScanBuffer = useCallback(() => {
    const scanned = scanBufferRef.current.trim();
    if (scanned) {
      onScan(scanned);
    }
    scanBufferRef.current = "";
    setValue("");
  }, [onScan]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();

    if (e.key === "Enter") {
      e.preventDefault();
      // If typing was fast (scanner), process buffer
      if (scanBufferRef.current) {
        processScanBuffer();
      } else if (value.trim()) {
        // Manual enter - submit anyway
        onScan(value.trim());
        setValue("");
      }
      lastKeyTimeRef.current = now;
      return;
    }

    // Track typing speed to detect scanner
    const timeSinceLastKey = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    if (timeSinceLastKey < SCAN_CHAR_INTERVAL_MS) {
      // Fast typing - likely scanner
      scanBufferRef.current += e.key;
    } else {
      // Slow typing - likely manual, clear buffer and reject
      scanBufferRef.current = "";
    }

    // Set timeout to process buffer if typing stops
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    scanTimeoutRef.current = setTimeout(() => {
      if (scanBufferRef.current.length > 1) {
        processScanBuffer();
      }
    }, 100);
  };

  // Prevent paste - only scanner input should work
  const handlePaste = (e: React.ReactClipboardEvent) => {
    e.preventDefault();
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder || "Quét mã..."}
            disabled={disabled}
            readOnly
            className="flex-1 text-base pr-10"
          />
          <Scan className="absolute right-12 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        </div>
        <Button
          onClick={startCamera}
          disabled={disabled}
          size="icon"
          variant="outline"
          title="Quét camera"
        >
          <Camera className="h-5 w-5" />
        </Button>
      </div>

      {cameraError && (
        <p className="text-sm text-destructive mt-2">{cameraError}</p>
      )}

      {showCamera && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-center justify-center">
          <div className="relative bg-card rounded-lg shadow-lg overflow-hidden max-w-sm w-full mx-4">
            <div ref={videoContainerRef} id={SCANNER_ID} className="aspect-square" />
            <Button
              onClick={stopCamera}
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 bg-background/50 hover:bg-background/70 z-10"
            >
              <X className="h-5 w-5" />
            </Button>
            <p className="text-center text-sm text-muted-foreground p-2">
              Đưa mã QR vào khung hình
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Normalize scan input - handles prefixes like PLT:, LOC:, TASK: */
export function normalizeScanCode(input: string): { type: "pallet" | "location" | "task" | "unknown"; code: string } {
  const trimmed = input.trim().toUpperCase();

  if (trimmed.startsWith("PLT:")) {
    return { type: "pallet", code: trimmed.slice(4).trim() };
  }
  if (trimmed.startsWith("LOC:")) {
    return { type: "location", code: trimmed.slice(4).trim() };
  }
  if (trimmed.startsWith("TASK:")) {
    return { type: "task", code: trimmed.slice(5).trim() };
  }

  // Try to infer type by pattern
  if (trimmed.startsWith("PLT")) {
    return { type: "pallet", code: trimmed };
  }
  if (trimmed.startsWith("LOC")) {
    return { type: "location", code: trimmed };
  }

  return { type: "unknown", code: trimmed };
}