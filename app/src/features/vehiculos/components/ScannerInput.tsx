import { useState, useRef, useEffect } from "react";
import { Search, Scan } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";

interface ScannerInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export const ScannerInput = ({
  onScan,
  placeholder,
  autoFocus = true,
  disabled = false,
}: ScannerInputProps) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("vehicles.scanPlaceholder");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (formRef.current?.contains(target) && inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && value.trim()) {
      onScan(value.trim());
      setValue("");
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="relative w-full max-w-2xl mx-auto"
    >
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Scan className="h-5 w-5" />
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          className="scanner-input scanner-pulse h-14 pl-12 pr-12 text-lg bg-card border-border rounded-xl shadow-sm focus:border-primary"
        />
        <button
          type="submit"
          disabled={disabled}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
      <p className="text-center text-sm text-muted-foreground mt-2">
        {t("vehicles.scannerReady")}
      </p>
    </form>
  );
};
