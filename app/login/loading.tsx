export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-red-600 dark:border-zinc-700 dark:border-t-red-400"
          aria-hidden
        />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading sign in...</p>
      </div>
    </div>
  );
}
