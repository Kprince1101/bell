import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { callbackUrl, magicLinkErrorMessage } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { browserTimeZone } from '@/lib/timeZone';

const resolveSubmitLabel = (isSending: boolean): string => {
  if (isSending) return 'Sending link...';
  return 'Email me a sign-in link';
};

export const useMagicLink = () => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setLinkError(null);
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: callbackUrl(
            window.location.origin,
            browserTimeZone(),
          ),
        },
      });
      if (error) throw error;
      setSentTo(email.trim());
    } catch (err) {
      setLinkError(magicLinkErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return {
    email,
    isSending,
    sentTo,
    linkError,
    submitLabel: resolveSubmitLabel(isSending),
    handleEmailChange,
    handleMagicLink,
  };
};
