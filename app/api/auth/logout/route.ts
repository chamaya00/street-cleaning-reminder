import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function GET(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}

export async function POST(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
