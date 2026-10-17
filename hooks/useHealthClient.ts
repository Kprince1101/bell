import { useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { summarizePanel, summaryTone } from '@/lib/health/summary';
import { fetchHealthPanel } from '@/lib/healthApi';
import type { HealthClientProps } from '@/types/health';

const REFRESH_KEY = 'refresh';

const refreshLabel = (isRefreshing: boolean): string => {
  if (isRefreshing) return 'Checking...';
  return 'Check again';
};

export const useHealthClient = ({ panel: initial }: HealthClientProps) => {
  const [panel, setPanel] = useState(initial);
  const request = useRequest();
  const isRefreshing = request.isPending(REFRESH_KEY);

  const handleRefresh = () =>
    request.run(REFRESH_KEY, async () => {
      setPanel(await fetchHealthPanel());
    });

  return {
    sections: panel.sections,
    summary: summarizePanel(panel.redCount),
    summaryTone: summaryTone(panel.redCount),
    error: request.error,
    showError: request.showError,
    isRefreshing,
    refreshLabel: refreshLabel(isRefreshing),
    handleRefresh,
  };
};
