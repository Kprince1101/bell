import { SHARED_BADGE_SUFFIX } from '@/lib/constants';
import type { AgendaBadge } from '@/types/agenda';

interface SourceBadgesProps {
  badges: AgendaBadge[];
}

export const SourceBadges = ({ badges }: SourceBadgesProps) => (
  <ul aria-label="Calendars" className="flex flex-wrap gap-2">
    {badges.map((badge) => (
      <li
        key={badge.key}
        className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs"
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: badge.color }}
        />
        {badge.label}
        {badge.shared && (
          <span className="text-text-muted">· {SHARED_BADGE_SUFFIX}</span>
        )}
      </li>
    ))}
  </ul>
);
