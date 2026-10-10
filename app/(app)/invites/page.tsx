import { requireOwnerInvites } from '@/lib/session';
import { InvitesClient } from './InvitesClient';

const InvitesPage = async () => {
  const invites = await requireOwnerInvites();
  return <InvitesClient invites={invites} />;
};

export default InvitesPage;
