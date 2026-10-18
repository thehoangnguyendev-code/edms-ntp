import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { cn } from "@/components/ui/utils";

/** The same classes as the text fields of Document Details and New Document (General tab): an editable field, and the read-only field. */
const EDITABLE = "w-full h-9 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";
const EDITABLE_TEXTAREA = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 resize-none placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { error?: boolean; fullWidth?: boolean };
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean; fullWidth?: boolean };

export function Input({ className, error, fullWidth: _fullWidth, readOnly, disabled, ...props }: InputProps) {
  return <input readOnly={readOnly} disabled={disabled} className={cn(readOnly || disabled ? CONTROL_STATE_CLASSES.readonlyField : EDITABLE, error && "border-red-300 focus:border-red-500 focus:ring-red-500", className)} {...props} />;
}

export function Textarea({ className, error, fullWidth: _fullWidth, readOnly, disabled, ...props }: TextareaProps) {
  return <textarea readOnly={readOnly} disabled={disabled} className={cn(readOnly || disabled ? CONTROL_STATE_CLASSES.readonlyTextarea : EDITABLE_TEXTAREA, error && "border-red-300 focus:border-red-500 focus:ring-red-500", className)} {...props} />;
}
