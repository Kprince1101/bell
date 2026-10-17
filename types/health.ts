import type { z } from 'zod';
import type { JOB_NAMES, healthReportSchema } from '@/lib/schemas/health';
import type { ChannelKind } from '@/types/notifications';

export type JobName = (typeof JOB_NAMES)[number];

export type HealthReport = z.infer<typeof healthReportSchema>;

export type HealthTone = 'green' | 'red' | 'grey';

export interface JobRun {
  job: JobName;
  ok: boolean;
  detail: string | null;
  at: string;
}

export interface ChannelTestResult {
  userId: string;
  kind: ChannelKind;
  ok: boolean;
  error: string | null;
  at: string;
}

export interface HealthCheck {
  key: string;
  label: string;
  tone: HealthTone;
  detail: string;
}

export interface HealthSection {
  key: string;
  title: string;
  checks: HealthCheck[];
}

export interface HealthPanel {
  checkedAt: string;
  redCount: number;
  sections: HealthSection[];
}

export interface HealthClientProps {
  panel: HealthPanel;
}
