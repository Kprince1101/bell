import { useState } from 'react';
import { disconnectGoogleAccount } from '@/lib/calendarsApi';
import { CALENDARS_PATH } from '@/lib/constants';
import { getErrorMessage } from '@/lib/errors';
import { redirectTo } from '@/lib/navigation';

const resolveDisconnectLabel = (
  pendingId: string | null,
  accountId: string,
): string => {
  if (pendingId === accountId) return 'Disconnecting...';
  return 'Disconnect';
};

export const useDisconnectAccount = () => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleDisconnect = (accountId: string) => async () => {
    if (pendingId) return;
    setPendingId(accountId);
    setDisconnectError(null);
    try {
      await disconnectGoogleAccount(accountId);
      redirectTo(`${CALENDARS_PATH}?notice=disconnected`);
    } catch (err) {
      setDisconnectError(getErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  return {
    disconnectError,
    showDisconnectError: Boolean(disconnectError),
    isDisconnecting: Boolean(pendingId),
    disconnectLabel: (accountId: string) =>
      resolveDisconnectLabel(pendingId, accountId),
    handleDisconnect,
  };
};
