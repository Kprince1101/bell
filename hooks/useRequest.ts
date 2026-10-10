import { useState } from 'react';
import { getErrorMessage } from '@/lib/errors';

export const useRequest = () => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (
    key: string,
    action: () => Promise<void>,
    success: string | null = null,
  ): Promise<boolean> => {
    if (pendingKey) return false;
    setPendingKey(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setPendingKey(null);
    }
  };

  return {
    error,
    notice,
    showError: Boolean(error),
    showNotice: Boolean(notice),
    isBusy: Boolean(pendingKey),
    isPending: (key: string) => pendingKey === key,
    run,
  };
};

export type RequestModel = ReturnType<typeof useRequest>;
