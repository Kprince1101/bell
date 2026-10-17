import { useState } from 'react';
import { callbackUrl } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/client';
import { browserTimeZone } from '@/lib/timeZone';

export const useGoogleSignIn = () => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setIsRedirecting(true);
    setGoogleError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl(window.location.origin, browserTimeZone()),
      },
    });
    if (!error) return;
    setGoogleError(getErrorMessage(error));
    setIsRedirecting(false);
  };

  return { isRedirecting, googleError, handleGoogle };
};
