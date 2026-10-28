"use client";

import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { RATINGS, ratingInfo } from "@/lib/ratings";
import type { Rating } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-blue-700 text-white hover:bg-blue-800 disabled:bg-blue-300",
  secondary: "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
  ghost: "text-blue-700 hover:bg-blue-50",
};

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx("min-h-12 rounded-xl px-4 py-2 text-base font-medium transition-colors disabled:cursor-not-allowed", VARIANTS[variant], className)}
    />
  );
}

export function LinkButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-2 text-base font-medium", VARIANTS[variant], className)}>
      {children}
    </Link>
  );
}

export function Chip({ selected, onClick, children, disabled, className }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "min-h-11 min-w-11 rounded-full border px-4 py-2 text-base transition-colors",
        selected ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        disabled && "opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
  allowClear = true,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.value} selected={value === o.value} disabled={disabled} onClick={() => onChange(value === o.value && allowClear ? null : o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

export function RatingBadge({ rating, className }: { rating: Rating | null | undefined; className?: string }) {
  const r = ratingInfo(rating);
  return <span className={cx("inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium", r.className, className)}>{r.label}</span>;
}

export function RatingPicker({ value, onChange, disabled }: { value: Rating | null | undefined; onChange: (r: Rating | null) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === r.value}
          onClick={() => onChange(value === r.value ? null : r.value)}
          className={cx(
            "min-h-11 rounded-full border px-3 py-2 text-sm font-medium",
            value === r.value ? cx(r.className, "ring-2 ring-offset-1 ring-slate-700") : "border-slate-300 bg-white text-slate-700",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function Collapsible({ title, right, children, defaultOpen = false }: { title: ReactNode; right?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={() => setOpen(!open)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex-1 text-base font-semibold text-slate-900">{title}</span>
        {right}
        <span className={cx("text-slate-500 transition-transform", open && "rotate-180")} aria-hidden>
          ▾
        </span>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warning" | "error"; children: ReactNode }) {
  const cls = {
    info: "bg-blue-50 text-blue-900 border-blue-200",
    warning: "bg-amber-50 text-amber-900 border-amber-300",
    error: "bg-red-50 text-red-900 border-red-300",
  }[kind];
  return <div className={cx("rounded-xl border px-3 py-2 text-sm", cls)}>{children}</div>;
}

export function PageHeader({ title, back, actions }: { title: string; back?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-2xl text-slate-700 hover:bg-slate-100" aria-label="Tillbaka">
          ‹
        </Link>
      )}
      <h1 className="flex-1 truncate text-xl font-bold text-slate-900">{title}</h1>
      {actions}
    </div>
  );
}
