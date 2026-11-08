import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-14 border-b border-line bg-s1" />
      <div className="flex flex-1">
        <div className="w-60 border-r border-line bg-s1 p-3 space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
        <div className="flex-1 px-8 py-6 space-y-4 max-w-[1280px]">
          <Skeleton className="h-7 w-72" /><Skeleton className="h-4 w-96" />
          <div className="grid grid-cols-6 gap-3 mt-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          <Skeleton className="h-5 w-40 mt-6" />
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
        </div>
      </div>
    </div>
  );
}
