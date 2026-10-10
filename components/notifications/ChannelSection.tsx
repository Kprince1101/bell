import type { ReactNode } from 'react';

interface ChannelSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

export const ChannelSection = ({
  title,
  description,
  children,
}: ChannelSectionProps) => (
  <section className="space-y-4 rounded-xl border border-border bg-card p-6">
    <header className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-text-muted">{description}</p>
    </header>
    {children}
  </section>
);
