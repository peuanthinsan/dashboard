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
      className="flex flex-col space-y-4 bg-[var(--surface-muted)] px-4 py-8 sm:px-16"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-xs text-[var(--text-muted)] uppercase"
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
          className="mt-1 block w-full appearance-none rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-xs text-[var(--text-muted)] uppercase"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 block w-full appearance-none rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-muted)] shadow-sm focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] sm:text-sm"
        />
      </div>
      {children}
    </form>
  );
}
