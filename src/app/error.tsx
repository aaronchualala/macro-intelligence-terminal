"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-neutral-100">
      <div className="w-full max-w-xl border border-neutral-800 bg-[#0a0a0a] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-wide text-neutral-400">
          <AlertTriangle className="h-4 w-4" />
          Dashboard error
        </div>
        <p className="mb-4 text-sm text-neutral-300">{error.message}</p>
        <Button onClick={reset} variant="secondary">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </main>
  );
}
