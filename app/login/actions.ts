'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, hashPassword } from '@/lib/auth';

export async function login(_prev: { error: string } | null, formData: FormData) {
  const password = formData.get('password');
  const expected = process.env.ANALYTICS_PASSWORD;

  if (!expected || typeof password !== 'string' || password !== expected) {
    return { error: 'Wrong password.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, await hashPassword(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });

  redirect('/');
}
