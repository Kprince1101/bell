import type { HealthTone } from '@/types/health';

export const summarizePanel = (redCount: number): string => {
  if (redCount === 0) return 'All green.';
  if (redCount === 1) return '1 check is red.';
  return `${redCount} checks are red.`;
};

export const summaryTone = (redCount: number): HealthTone => {
  if (redCount === 0) return 'green';
  return 'red';
};
