'use client';

import { InviteForm } from '@/components/invites/InviteForm';
import { InviteList } from '@/components/invites/InviteList';
import { Message } from '@/components/ui/Message';
import { useInvitesClient } from '@/hooks/useInvitesClient';
import type { InvitesClientProps } from '@/types/invites';

export const InvitesClient = ({ invites }: InvitesClientProps) => {
  const {
    formAction,
    isPending,
    submitLabel,
    message,
    messageTone,
    showMessage,
  } = useInvitesClient();

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-text-muted">
          People on this list can sign in to Bell with Google or an email link.
        </p>
      </section>
      <InviteForm
        formAction={formAction}
        isPending={isPending}
        submitLabel={submitLabel}
      />
      {showMessage && <Message tone={messageTone} text={message} />}
      <InviteList invites={invites} />
    </div>
  );
};
