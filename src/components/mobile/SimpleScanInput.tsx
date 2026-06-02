import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface SimpleScanInputProps {
  placeholder?: string;
  onScan: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function SimpleScanInput({ placeholder = "Nhập hoặc quét mã...", onScan, disabled, autoFocus = true }: SimpleScanInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onScan(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 text-base"
      />
      <Button onClick={handleSubmit} disabled={disabled || !value.trim()}>
        OK
      </Button>
    </div>
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