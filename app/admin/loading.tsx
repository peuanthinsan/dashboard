import { cardSection, pageContent } from 'app/ui/design-tokens';

export default function AdminLoading() {
  return (
    <div className={pageContent}>
      <div className="mb-8 animate-pulse">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-4 w-72 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${cardSection} animate-pulse`}>
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-3 h-8 w-12 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <div className="h-10 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${cardSection} animate-pulse p-5`}>
              <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="mt-3 h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="mt-2 h-3 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
