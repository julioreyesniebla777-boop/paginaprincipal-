import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const base =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-zinc-50 sm:text-sm";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} className={cn(base, "h-11 sm:h-10", invalid && "border-red-500", className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return <textarea ref={ref} className={cn(base, "py-2", invalid && "border-red-500", className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, ...props }, ref) {
    return <select ref={ref} className={cn(base, "h-11 sm:h-10", invalid && "border-red-500", className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string | string[];
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {msg ? <p className="text-sm text-red-600">{msg}</p> : hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-2 text-sm text-zinc-700", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand" {...props} />
      <span>{label}</span>
    </label>
  );
}
