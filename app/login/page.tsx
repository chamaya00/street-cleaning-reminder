import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginPageClient } from '@/components/auth/LoginPageClient';

// This page uses cookies for authentication, so it must be dynamic
export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string; blocks?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = params.redirect || '/notifications';
  const pendingBlocks = params.blocks;

  // Check if user is already authenticated
  const { user } = await getSessionUser();

  if (user) {
    // User is already logged in, redirect to intended destination
    redirect(redirectTo);
  }

  return (
    <LoginPageClient
      redirectTo={redirectTo}
      pendingBlocks={pendingBlocks}
    />
  );
}
