import { resolveLoginMessages } from '@/lib/auth';
import type { LoginSearchParams } from '@/lib/auth';
import { redirectIfSignedIn } from '@/lib/session';
import { LoginClient } from './LoginClient';

interface LoginPageProps {
  searchParams: Promise<LoginSearchParams>;
}

const LoginPage = async ({ searchParams }: LoginPageProps) => {
  await redirectIfSignedIn();
  const { error, notice } = resolveLoginMessages(await searchParams);
  return <LoginClient error={error} notice={notice} />;
};

export default LoginPage;
