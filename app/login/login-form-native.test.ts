import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getSiteCopy } from 'app/site-i18n-copy';
import { LoginForm } from './login-form';
import type { LoginState } from './actions';

describe('native login form', () => {
  it('preserves the encoded server action before hydration without mocking React hooks', () => {
    const action = Object.assign(
      vi.fn<(state: LoginState, data: FormData) => Promise<LoginState>>(
        async () => ({ error: null, success: true }),
      ),
      { $$FORM_ACTION: () => ({
        name: '$ACTION_ID_native-login',
        action: '/login',
        method: 'POST',
        encType: 'multipart/form-data',
        data: new FormData(),
      }) },
    );
    // RSC server references retain their form metadata when React binds initial state.
    Object.defineProperty(action, 'bind', {
      value: (...[, state]: [unknown, LoginState]) => Object.assign(
        (data: FormData) => action(state, data),
        { $$FORM_ACTION: action.$$FORM_ACTION },
      ),
    });
    const html = renderToStaticMarkup(createElement(LoginForm, { action, copy: getSiteCopy('en').login }));
    expect(html).toContain('action="/login"');
    expect(html).toContain('method="POST"');
    expect(html).toContain('name="$ACTION_ID_native-login"');
    expect(action).not.toHaveBeenCalled();
  });
});
