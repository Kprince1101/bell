import { sendJson } from '@/lib/apiClient';
import type { HealthPanel } from '@/types/health';

export const fetchHealthPanel = async (): Promise<HealthPanel> =>
  (await sendJson('/api/health', { method: 'GET' })) as unknown as HealthPanel;
