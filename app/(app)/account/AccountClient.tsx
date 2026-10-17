'use client';

import { DeleteAccountForm } from '@/components/account/DeleteAccountForm';
import { TimeZoneForm } from '@/components/account/TimeZoneForm';
import { useAccountClient } from '@/hooks/useAccountClient';
import type { AccountClientProps } from '@/types/account';

export const AccountClient = (props: AccountClientProps) => {
  const { timeZoneSetting, deletion } = useAccountClient(props);

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold">Account</h1>
        <p className="text-text-muted">{props.email}</p>
      </section>
      <TimeZoneForm timeZones={props.timeZones} setting={timeZoneSetting} />
      <DeleteAccountForm deletion={deletion} />
    </div>
  );
};
