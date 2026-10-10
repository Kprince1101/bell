import {
  loadNotificationsView,
  resolveNotifyMessages,
} from '@/lib/notify/view';
import type { NotificationsSearchParams } from '@/lib/notify/view';
import { requireBellUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { NotificationsClient } from './NotificationsClient';

interface NotificationsPageProps {
  searchParams: Promise<NotificationsSearchParams>;
}

const NotificationsPage = async ({ searchParams }: NotificationsPageProps) => {
  const user = await requireBellUser();
  const view = await loadNotificationsView(
    await createClient(),
    user.time_zone,
    new Date(),
  );
  const { error, notice } = resolveNotifyMessages(await searchParams);
  return <NotificationsClient {...view} error={error} notice={notice} />;
};

export default NotificationsPage;
