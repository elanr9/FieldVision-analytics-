import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, hashPassword } from './lib/auth';

export async function middleware(request: NextRequest) {
  const password = process.env.ANALYTICS_PASSWORD;
  if (!password) {
    return new NextResponse('ANALYTICS_PASSWORD is not configured', { status: 500 });
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const expected = await hashPassword(password);

  if (cookie === expected) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!login|api/notify|_next/static|_next/image|favicon.ico).*)'],
};
