interface HealthDetailsProps {
  details: string[];
}

export const HealthDetails = ({ details }: HealthDetailsProps) => (
  <ul className="w-full space-y-0.5 text-xs text-text-muted">
    {details.map((detail) => (
      <li key={detail} className="break-words">
        {detail}
      </li>
    ))}
  </ul>
);
