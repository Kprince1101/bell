import type { ReactNode } from 'react';
import { AppHeader } from '@/components/shell/AppHeader';
import { requireBellUser } from '@/lib/session';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = async ({ children }: AppLayoutProps) => {
  const user = await requireBellUser();

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {children}
      </main>
    </>
  );
};

export default AppLayout;
