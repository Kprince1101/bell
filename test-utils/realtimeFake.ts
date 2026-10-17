export const createRealtimeFake = () => {
  const handlers: Array<() => void> = [];
  const statuses: Array<(status: string) => void> = [];
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: () => void) => {
      handlers.push(handler);
      return channel;
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      statuses.push(callback);
      return channel;
    }),
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  };
  return {
    client,
    channel,
    emitChange: () => handlers.forEach((handler) => handler()),
    emitStatus: (status: string) =>
      statuses.forEach((callback) => callback(status)),
  };
};
