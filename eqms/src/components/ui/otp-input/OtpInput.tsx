import { useRef } from "react";
import { cn } from "../utils";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  className?: string;
}

/** A code of digits in one square box for each digit, as on the two-factor screen: typing moves on, Backspace goes back, a pasted code fills the boxes. */
export function OtpInput({ value, onChange, length = 6, disabled, autoFocus, ariaLabel = "Code digit", className }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_x, i) => value[i] ?? "");
  const focus = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();
  const set = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  };
  return (
    <div className={cn("grid gap-2 sm:gap-3", className)} style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      onPaste={(e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        onChange(pasted);
        focus(pasted.length >= length ? length - 1 : pasted.length);
      }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { refs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`${ariaLabel} ${index + 1}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) { set(index, ""); return; }
            set(index, typed.slice(-1));
            focus(index + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[index]) { e.preventDefault(); set(Math.max(0, index - 1), ""); focus(index - 1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); focus(index - 1); }
            else if (e.key === "ArrowRight") { e.preventDefault(); focus(index + 1); }
          }}
          className={cn(
            "otp-input h-14 w-full rounded-[12px] border text-center font-bold outline-none leading-normal transition-all focus:ring-1 focus:ring-emerald-600",
            digit ? "border-emerald-600 bg-emerald-50/20 text-emerald-900" : "border-slate-200 bg-white focus:border-emerald-600",
          )}
        />
      ))}
    </div>
  );
}
