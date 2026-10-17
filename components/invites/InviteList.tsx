import type { Invite } from '@/types/invites';

interface InviteListProps {
  invites: Invite[];
}

export const InviteList = ({ invites }: InviteListProps) => (
  <ul className="divide-y divide-border rounded-xl border border-border">
    {invites.map((invite) => (
      <li
        key={invite.email}
        className="flex items-center justify-between px-4 py-3 text-sm"
      >
        <span>{invite.email}</span>
        <span className="text-text-muted">{invite.role}</span>
      </li>
    ))}
  </ul>
);
