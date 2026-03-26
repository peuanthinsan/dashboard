import { inputBase, labelBase } from 'app/ui/design-tokens';

type FormAction = string | ((formData: FormData) => void | Promise<void>);

export function Form({
  action,
  children,
}: {
  action: FormAction;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelBase}>
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="user@acme.com"
          autoComplete="email"
          required
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelBase}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          className={`mt-1.5 ${inputBase}`}
        />
      </div>
      {children}
    </form>
  );
}
