import { requireBellUser } from '@/lib/session';
import { listTimeZones } from '@/lib/timeZone';
import { AccountClient } from './AccountClient';

const AccountPage = async () => {
  const user = await requireBellUser();

  return (
    <AccountClient
      email={user.email}
      timeZone={user.time_zone}
      timeZones={listTimeZones()}
    />
  );
};

export default AccountPage;
