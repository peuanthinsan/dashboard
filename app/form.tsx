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
      className="flex flex-col space-y-4 bg-gray-50 px-4 py-8 text-slate-900 dark:bg-slate-900 dark:text-white sm:px-16"
    >
      <div>
        <label
          htmlFor="email"
          className="block text-xs text-gray-600 uppercase dark:text-slate-400"
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
          className="mt-1 block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-slate-900 placeholder-gray-400 shadow-sm focus:border-black focus:outline-none focus:ring-black dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400 sm:text-sm"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-xs text-gray-600 uppercase dark:text-slate-400"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 block w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-slate-900 placeholder-gray-400 shadow-sm focus:border-black focus:outline-none focus:ring-black dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400 sm:text-sm"
        />
      </div>
      {children}
    </form>
  );
}
