export const AUTH_COOKIE = 'fv_analytics_session';

/** SHA-256 hex of the password. Web Crypto so it runs in middleware and Node. */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`fieldvision-analytics:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
