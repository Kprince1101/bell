import type { LoginMessages } from '@/lib/auth';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { useMagicLink } from '@/hooks/useMagicLink';

const resolveSentNotice = (sentTo: string | null): string | null => {
  if (!sentTo) return null;
  return `Check ${sentTo} for a sign-in link.`;
};

export const useLoginClient = ({ error, notice }: LoginMessages) => {
  const google = useGoogleSignIn();
  const magicLink = useMagicLink();
  const errorMessage = magicLink.linkError ?? google.googleError ?? error;
  const noticeMessage = resolveSentNotice(magicLink.sentTo) ?? notice;

  return {
    ...google,
    ...magicLink,
    errorMessage,
    noticeMessage,
    showError: Boolean(errorMessage),
    showNotice: Boolean(noticeMessage),
  };
};
