import type { HealthCheck, HealthTone } from '@/types/health';

const DOT_CLASSES: Record<HealthTone, string> = {
  green: 'bg-success',
  red: 'bg-danger',
  grey: 'bg-text-muted opacity-60',
};

const DETAIL_CLASSES: Record<HealthTone, string> = {
  green: 'text-text-muted',
  red: 'font-semibold text-danger',
  grey: 'text-text-muted opacity-60',
};

const TONE_NAMES: Record<HealthTone, string> = {
  green: 'OK',
  red: 'Needs attention',
  grey: 'Off',
};

interface HealthCheckRowProps {
  check: HealthCheck;
}

export const HealthCheckRow = ({ check }: HealthCheckRowProps) => (
  <li className="flex items-start gap-3 py-2">
    <span
      role="img"
      aria-label={TONE_NAMES[check.tone]}
      className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASSES[check.tone]}`}
    />
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm font-medium">{check.label}</p>
      <p className={`text-xs break-words ${DETAIL_CLASSES[check.tone]}`}>
        {check.detail}
      </p>
    </div>
  </li>
);
