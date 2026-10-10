import type { ReactNode } from 'react';

interface AuthCardProps {
  subtitle: string;
  children: ReactNode;
}

export const AuthCard = ({ subtitle, children }: AuthCardProps) => (
  <main className="flex min-h-screen flex-col items-center justify-center p-4">
    <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-accent">Bell</h1>
        <p className="mt-2 text-sm text-text-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  </main>
);
