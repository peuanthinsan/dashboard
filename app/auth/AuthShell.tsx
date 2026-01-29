type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="z-10 w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col items-center justify-center space-y-3 border-b border-gray-200 bg-white px-4 py-6 pt-8 text-center dark:border-slate-800 dark:bg-slate-900 sm:px-16">
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
