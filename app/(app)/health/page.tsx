import { loadHealthPanel } from '@/lib/health/panel';
import { requireOwnerUser } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { HealthClient } from './HealthClient';

const HealthPage = async () => {
  const user = await requireOwnerUser();
  const panel = await loadHealthPanel(
    createAdminClient(),
    user.id,
    process.env,
    new Date(),
  );
  return <HealthClient panel={panel} />;
};

export default HealthPage;
