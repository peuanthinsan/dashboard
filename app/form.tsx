type FormAction = string | ((formData: FormData) => void | Promise<void>);

export function Form({
  action,
  children,
}: {
  action: FormAction;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className="flex flex-col space-y-4 bg-[var(--app-surface-muted)] px-4 py-8 sm:px-16"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-xs uppercase text-[var(--app-text-subtle)]"
        >
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          className="mt-1 block w-full appearance-none rounded-md border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] shadow-sm focus:border-[var(--app-text)] focus:outline-none focus:ring-[var(--app-text)] sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-xs uppercase text-[var(--app-text-subtle)]"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 block w-full appearance-none rounded-md border border-[var(--app-border-strong)] bg-[var(--app-input-bg)] px-3 py-2 text-[var(--app-text)] placeholder:text-[var(--app-text-faint)] shadow-sm focus:border-[var(--app-text)] focus:outline-none focus:ring-[var(--app-text)] sm:text-sm"
        />
      </div>
      {children}
    </form>
  );
}
