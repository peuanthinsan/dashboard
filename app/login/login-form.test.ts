import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSiteCopy } from 'app/site-i18n-copy';

const state = vi.hoisted(() => ({ success: false, pending: false }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useActionState: () => [{ error: null, success: state.success }, vi.fn()],
}));
vi.mock('react-dom', async importOriginal => ({
  ...await importOriginal<typeof import('react-dom')>(),
  useFormStatus: () => ({ pending: state.pending }),
}));
import { LoginForm } from './login-form';
const copy = getSiteCopy('en').login;
function buttonMarkup() {
  const markup = renderToStaticMarkup(createElement(LoginForm, {
    copy, action: async () => ({ error: null, success: true }),
  }));
  return markup.match(/<button\b[^>]*>/)?.[0] ?? '';
}
beforeEach(() => { state.success = false; state.pending = false; });
describe('login submission lock', () => {
  it('disables the actual submit button while signing in', () => {
    state.pending = true;
    expect(buttonMarkup()).toContain('disabled=""');
  });
  it('keeps the button disabled after success until the document changes', () => {
    state.success = true;
    expect(buttonMarkup()).toContain('disabled=""');
  });
  it('allows an initial or failed sign-in to be submitted', () => {
    expect(buttonMarkup()).not.toContain('disabled=""');
  });
});
