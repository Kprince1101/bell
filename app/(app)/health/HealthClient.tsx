'use client';

import { HealthSectionCard } from '@/components/health/HealthSectionCard';
import { Message } from '@/components/ui/Message';
import { useHealthClient } from '@/hooks/useHealthClient';
import type { HealthClientProps, HealthTone } from '@/types/health';

const SUMMARY_CLASSES: Record<HealthTone, string> = {
  green: 'text-success',
  red: 'font-semibold text-danger',
  grey: 'text-text-muted',
};

export const HealthClient = (props: HealthClientProps) => {
  const view = useHealthClient(props);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Health</h1>
          <p role="status" className={SUMMARY_CLASSES[view.summaryTone]}>
            {view.summary}
          </p>
        </div>
        <button
          type="button"
          onClick={view.handleRefresh}
          disabled={view.isRefreshing}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:text-accent disabled:opacity-60"
        >
          {view.refreshLabel}
        </button>
      </header>
      {view.showError && <Message tone="error" text={view.error} />}
      {view.sections.map((section) => (
        <HealthSectionCard key={section.key} section={section} />
      ))}
    </div>
  );
};
