import { useActionState } from 'react';
import { inviteAction } from '@/app/(app)/invites/actions';
import { INITIAL_INVITE_STATE } from '@/lib/invites';
import type { InviteStatus } from '@/types/invites';
import type { MessageTone } from '@/types/ui';

const MESSAGE_TONES: Record<InviteStatus, MessageTone> = {
  idle: 'notice',
  invited: 'notice',
  error: 'error',
};

const resolveSubmitLabel = (isPending: boolean): string => {
  if (isPending) return 'Inviting...';
  return 'Invite';
};

export const useInvitesClient = () => {
  const [state, formAction, isPending] = useActionState(
    inviteAction,
    INITIAL_INVITE_STATE,
  );

  return {
    formAction,
    isPending,
    submitLabel: resolveSubmitLabel(isPending),
    message: state.message,
    messageTone: MESSAGE_TONES[state.status],
    showMessage: Boolean(state.message),
  };
};
