import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#050505] p-4 text-neutral-100 md:p-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-2 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-[520px] w-full" />
      </div>
    </main>
  );
}
