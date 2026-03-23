import { pageContent } from 'app/ui/design-tokens';

export default function ChangePasswordLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className={pageContent}>
        <div className="mx-auto max-w-sm py-12">
          <div className="mb-8 animate-pulse text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            <div className="mx-auto h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mx-auto mt-2 h-4 w-64 rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="space-y-4">
            <div className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-full rounded-lg bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-10 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
