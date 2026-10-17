'use client';

import { AuthCard } from '@/components/auth/AuthCard';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { MagicLinkForm } from '@/components/auth/MagicLinkForm';
import { Message } from '@/components/ui/Message';
import { useLoginClient } from '@/hooks/useLoginClient';
import type { LoginMessages } from '@/lib/auth';

export const LoginClient = (props: LoginMessages) => {
  const {
    email,
    isSending,
    isRedirecting,
    submitLabel,
    errorMessage,
    noticeMessage,
    showError,
    showNotice,
    handleEmailChange,
    handleMagicLink,
    handleGoogle,
  } = useLoginClient(props);

  return (
    <AuthCard subtitle="Sign in to see your day">
      {showNotice && <Message tone="notice" text={noticeMessage} />}
      <GoogleButton disabled={isRedirecting} onClick={handleGoogle} />
      <p className="text-center text-xs uppercase tracking-wide text-text-muted">
        or
      </p>
      <MagicLinkForm
        email={email}
        isSending={isSending}
        submitLabel={submitLabel}
        onEmailChange={handleEmailChange}
        onSubmit={handleMagicLink}
      />
      {showError && <Message tone="error" text={errorMessage} />}
      <p className="text-center text-xs text-text-muted">
        Bell is invite-only. Ask the owner to add your email.
      </p>
    </AuthCard>
  );
};
