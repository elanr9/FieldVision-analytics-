'use client';

import { useActionState } from 'react';
import { login } from './actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold">FieldVision Analytics</h1>
        <p className="mt-1 text-sm text-neutral-500">Enter the dashboard password.</p>
        <input
          type="password"
          name="password"
          autoFocus
          required
          placeholder="Password"
          className="mt-4 w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  );
}
