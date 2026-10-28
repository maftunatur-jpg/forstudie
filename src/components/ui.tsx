"use client";

import Link from "next/link";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { RATINGS, ratingInfo } from "@/lib/ratings";
import type { Rating } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent border border-accent font-semibold disabled:opacity-50",
  secondary: "bg-card text-ink border border-line font-semibold disabled:opacity-50",
  danger: "bg-transparent text-bad border border-bad font-semibold",
  ghost: "bg-transparent text-accent border border-transparent font-semibold",
};

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx("min-h-12 cursor-pointer rounded-xl px-4 py-3 text-[15px] disabled:cursor-not-allowed", VARIANTS[variant], className)}
    />
  );
}

export function LinkButton({ href, children, variant = "primary", className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <Link href={href} className={cx("inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-3 text-[15px]", VARIANTS[variant], className)}>
      {children}
    </Link>
  );
}

/** Knapp i rubrikraden (vit kontur på marinblått). */
export function HeaderButton({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls = "inline-flex min-h-10 items-center rounded-lg border border-current px-3 py-2 text-sm font-semibold text-on-accent";
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls + " cursor-pointer"}>
      {children}
    </button>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  disabled,
  mono,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "min-h-10 cursor-pointer rounded-full border px-[13px] py-2 text-sm font-medium",
        mono && "min-w-11 font-mono",
        selected ? "border-accent bg-accent text-on-accent" : "border-line bg-paper text-ink",
        disabled && "cursor-default opacity-60",
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
  mono,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip key={o.value} mono={mono} selected={value === o.value} disabled={disabled} onClick={() => onChange(value === o.value && allowClear ? null : o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold">
      {children}
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[12.5px] text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-[10px] border border-line bg-paper px-3 py-[11px] text-base text-ink placeholder:text-muted disabled:opacity-60";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-line bg-card p-[14px]", className)}>{children}</div>;
}

/** Rubrik i versaler i accentfärg, som i sektionerna. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
      <span>{children}</span>
      {right && <span className="font-mono text-xs font-medium normal-case tracking-normal text-muted">{right}</span>}
    </div>
  );
}

/** Platsetikett i listor (t.ex. "B · 3 tr"). */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="min-w-[58px] rounded-lg bg-accent-soft px-2 py-2 text-center font-mono text-[13px] font-semibold leading-tight text-accent">{children}</span>;
}

export function RatingBadge({ rating, className }: { rating: Rating | null | undefined; className?: string }) {
  const r = ratingInfo(rating);
  return (
    <span className={cx("whitespace-nowrap rounded-full border border-current px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.05em]", r.text, className)}>
      {rating ? r.label : "Ej bedömd"}
    </span>
  );
}

export function RatingPicker({ value, onChange, disabled }: { value: Rating | null | undefined; onChange: (r: Rating | null) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {RATINGS.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === r.value}
          onClick={() => onChange(value === r.value ? null : r.value)}
          className={cx(
            "min-h-10 cursor-pointer rounded-full border px-[13px] py-2 text-sm font-medium",
            value === r.value ? r.fill : cx("border-line bg-paper", r.text),
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** Hopfällbar sektion: rubrik i versaler och räknare till höger. */
export function Collapsible({ title, right, children, defaultOpen = false }: { title: ReactNode; right?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-line bg-card" open={defaultOpen || undefined}>
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-[14px] py-[14px] text-xs font-semibold uppercase tracking-[0.08em] text-accent">
        <span className="flex-1">{title}</span>
        {right && <span className="flex items-center gap-2 font-mono text-xs font-medium normal-case tracking-normal text-muted">{right}</span>}
        <span className="text-muted transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-[14px] px-[14px] pb-[14px]">{children}</div>
    </details>
  );
}

export function Alert({ kind = "info", children }: { kind?: "info" | "warning" | "error"; children: ReactNode }) {
  const cls = {
    info: "border-line bg-card text-ink",
    warning: "border-warn bg-card text-ink",
    error: "border-bad bg-card text-bad",
  }[kind];
  return <div className={cx("rounded-xl border px-3 py-2.5 text-sm", kind === "warning" && "border-l-4", cls)}>{children}</div>;
}

export function Status({ children }: { children: ReactNode }) {
  return <div className="text-[13px] text-muted">{children}</div>;
}

/** Tom lista med streckad ram. */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line bg-card p-5 text-center text-muted">{children}</div>;
}

/** Sidans rubrik visas i den marinblå rubrikraden (portal till AppShell). */
export function PageHeader({ title, sub, back, actions }: { title: string; sub?: string; back?: string; actions?: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platsen finns först efter montering
    setSlot(document.getElementById("page-header-slot"));
  }, []);
  if (!slot) return null;
  return createPortal(
    <div className="flex items-center gap-3">
      {back && (
        <Link href={back} aria-label="Tillbaka" className="-ml-2 flex min-h-10 min-w-10 items-center justify-center rounded-lg text-2xl leading-none text-on-accent">
          ‹
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {sub && <small className="block truncate font-mono text-[11px] font-medium uppercase tracking-[0.04em] opacity-80">{sub}</small>}
        <h1 className="m-0 truncate text-[17px] font-semibold leading-tight">{title}</h1>
      </div>
      {actions}
    </div>,
    slot,
  );
}

/** Fast knapprad längst ner med tonad bakgrund. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-paper from-70% to-transparent pt-[14px] pb-[calc(14px+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[720px] gap-2.5 px-4">{children}</div>
      </div>
    </>
  );
}
