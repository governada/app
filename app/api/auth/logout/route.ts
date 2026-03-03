import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const POST = withRouteHandler(async () => {
  const response = NextResponse.json({ ok: true });

  response.cookies.set('drepscore_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
});
