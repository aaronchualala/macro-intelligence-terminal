import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "neutral",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "neutral" | "good" | "warn" | "risk";
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex h-5 max-w-full items-center border px-1.5 text-[10px] font-medium uppercase leading-none tracking-wide",
        tone === "neutral" && "border-neutral-700 bg-neutral-950 text-neutral-400",
        tone === "good" && "border-green-500/40 bg-green-950/30 text-green-200",
        tone === "warn" && "border-yellow-500/40 bg-yellow-950/20 text-yellow-200",
        tone === "risk" && "border-red-500/40 bg-red-950/30 text-red-200",
        className
      )}
    >
      {children}
    </span>
  );
}
