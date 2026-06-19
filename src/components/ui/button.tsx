"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-sm border px-3 text-xs font-medium uppercase tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400",
        variant === "default" && "border-neutral-100 bg-neutral-100 text-black hover:bg-neutral-300",
        variant === "secondary" && "border-neutral-700 bg-neutral-950 text-neutral-100 hover:border-neutral-500 hover:bg-[#101010]",
        variant === "ghost" && "border-transparent bg-transparent text-neutral-300 hover:border-neutral-800 hover:bg-neutral-900 hover:text-neutral-50",
        variant === "danger" && "border-red-500/50 bg-red-950/30 text-red-200 hover:bg-red-950/60",
        className
      )}
      {...props}
    />
  );
}
