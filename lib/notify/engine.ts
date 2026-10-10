import { attemptDelivery } from '@/lib/notify/deliver';
import type { NotifyServices } from '@/lib/notify/services';
import type { Delivery } from '@/types/notifications';

export interface NotifyReport {
  materialized: number;
  due: number;
  sent: number;
  failed: number;
  fallbacks: number;
}

interface ChainReport {
  sent: number;
  failed: number;
  fallbacks: number;
}

const errorSuffix = (error: string | null): string => {
  if (!error) return '';
  return ` error=${error}`;
};

const deliverChain = async (
  services: NotifyServices,
  delivery: Delivery,
  now: string,
): Promise<ChainReport> => {
  const outcome = await attemptDelivery(services, delivery);
  await services.repo.finish(
    delivery.id,
    outcome,
    services.now().toISOString(),
  );
  services.log(
    `[bell] notify notification=${delivery.id} event=${delivery.event_id} step=${delivery.step} channel=${delivery.channel} result=${outcome.result}${errorSuffix(outcome.error)}`,
  );
  if (outcome.result === 'sent') return { sent: 1, failed: 0, fallbacks: 0 };

  const next = await services.repo.claimFallback(delivery.id, now);
  if (!next) return { sent: 0, failed: 1, fallbacks: 0 };
  const rest = await deliverChain(services, next, now);
  return {
    sent: rest.sent,
    failed: rest.failed + 1,
    fallbacks: rest.fallbacks + 1,
  };
};

export const runNotify = async (
  services: NotifyServices,
): Promise<NotifyReport> => {
  const now = services.now().toISOString();
  const materialized = await services.repo.materialize(now);
  const due = await services.repo.claimDue(now);
  const chains = await Promise.all(
    due.map((delivery) => deliverChain(services, delivery, now)),
  );
  const report = chains.reduce<NotifyReport>(
    (total, chain) => ({
      ...total,
      sent: total.sent + chain.sent,
      failed: total.failed + chain.failed,
      fallbacks: total.fallbacks + chain.fallbacks,
    }),
    { materialized, due: due.length, sent: 0, failed: 0, fallbacks: 0 },
  );
  services.log(
    `[bell] notify-tick materialized=${report.materialized} due=${report.due} sent=${report.sent} failed=${report.failed} fallbacks=${report.fallbacks}`,
  );
  return report;
};
