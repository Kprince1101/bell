import { HealthCheckRow } from '@/components/health/HealthCheckRow';
import type { HealthSection } from '@/types/health';

interface HealthSectionCardProps {
  section: HealthSection;
}

export const HealthSectionCard = ({ section }: HealthSectionCardProps) => (
  <section
    aria-labelledby={`health-${section.key}`}
    className="rounded-xl border border-border bg-card p-6"
  >
    <h2 id={`health-${section.key}`} className="text-lg font-semibold">
      {section.title}
    </h2>
    <ul className="mt-2 divide-y divide-border">
      {section.checks.map((check) => (
        <HealthCheckRow key={check.key} check={check} />
      ))}
    </ul>
  </section>
);
