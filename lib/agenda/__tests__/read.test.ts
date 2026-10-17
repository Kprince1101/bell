import { loadAgendaRows, recordAgendaVisit } from '@/lib/agenda/read';
import type { AgendaReader } from '@/lib/agenda/read';
import { AGENDA_NOW, PERSONAL, agendaEvent } from '@/test-utils/agendaFakes';
import { USER_ID } from '@/test-utils/supabaseFake';

type Result = { data: unknown; error: unknown };

const queryFor = (result: Result) => {
  const calls: unknown[][] = [];
  const link =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
      return chain;
    };
  const finish =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return result;
    };
  const chain = {
    calls,
    select: link('select'),
    eq: link('eq'),
    in: link('in'),
    lt: link('lt'),
    gt: link('gt'),
    order: finish('order'),
    maybeSingle: finish('maybeSingle'),
    upsert: finish('upsert'),
  };
  return chain;
};

const fakeClient = (
  results: Record<string, Result[]>,
  sharedWithMe: Result = { data: [], error: null },
) => {
  const queries: Record<string, ReturnType<typeof queryFor>[]> = {};
  const client = {
    from: vi.fn((table: string) => {
      const next = results[table].shift() ?? { data: null, error: null };
      const query = queryFor(next);
      queries[table] = [...(queries[table] ?? []), query];
      return query;
    }),
    rpc: vi.fn(async () => sharedWithMe),
  };
  return {
    client: client as unknown as AgendaReader,
    queries,
    rpc: client.rpc,
  };
};

const SHARED_ROW = {
  id: '55555555-5555-5555-5555-555555555555',
  label: 'Team standups',
  color: '#0b8043',
};

const RANGE = {
  from: '2026-10-09T05:00:00.000Z',
  to: '2026-10-19T05:00:00.000Z',
};

describe('loadAgendaRows', () => {
  it('reads only included, unpaused calendars and their events in range', async () => {
    const { client, queries } = fakeClient({
      calendars: [{ data: [PERSONAL], error: null }],
      events: [{ data: [agendaEvent()], error: null }],
    });

    const rows = await loadAgendaRows(client, USER_ID, RANGE);

    expect(rows).toEqual({ calendars: [PERSONAL], events: [agendaEvent()] });
    expect(queries.calendars[0].calls).toEqual(
      expect.arrayContaining([
        ['eq', 'user_id', USER_ID],
        ['eq', 'active', true],
        ['eq', 'paused', false],
      ]),
    );
    expect(queries.events[0].calls).toEqual(
      expect.arrayContaining([
        ['in', 'calendar_id', [PERSONAL.id]],
        ['lt', 'starts_at', RANGE.to],
        ['gt', 'ends_at', RANGE.from],
      ]),
    );
  });

  it('adds calendars shared with the user, marked shared, and reads their events too', async () => {
    const { client, queries, rpc } = fakeClient(
      {
        calendars: [{ data: [PERSONAL], error: null }],
        events: [{ data: [agendaEvent()], error: null }],
      },
      { data: [SHARED_ROW], error: null },
    );

    const rows = await loadAgendaRows(client, USER_ID, RANGE);

    expect(rpc).toHaveBeenCalledWith('shared_with_me');
    expect(rows.calendars).toEqual([PERSONAL, { ...SHARED_ROW, shared: true }]);
    expect(queries.events[0].calls).toEqual(
      expect.arrayContaining([
        ['in', 'calendar_id', [PERSONAL.id, SHARED_ROW.id]],
      ]),
    );
  });

  it('shows a shared calendar even when the user has none of their own', async () => {
    const { client } = fakeClient(
      {
        calendars: [{ data: [], error: null }],
        events: [{ data: [], error: null }],
      },
      { data: [SHARED_ROW], error: null },
    );

    const rows = await loadAgendaRows(client, USER_ID, RANGE);

    expect(rows.calendars).toEqual([{ ...SHARED_ROW, shared: true }]);
  });

  it('skips the events query when no calendar is shown', async () => {
    const { client, queries } = fakeClient({
      calendars: [{ data: [], error: null }],
      events: [],
    });

    expect(await loadAgendaRows(client, USER_ID, RANGE)).toEqual({
      calendars: [],
      events: [],
    });
    expect(queries.events).toBeUndefined();
  });

  it('throws a failed read', async () => {
    const { client } = fakeClient({
      calendars: [{ data: null, error: new Error('boom') }],
    });

    await expect(loadAgendaRows(client, USER_ID, RANGE)).rejects.toThrow(
      'boom',
    );
  });
});

describe('recordAgendaVisit', () => {
  it('stores the new visit and returns its baseline', async () => {
    const { client, queries } = fakeClient({
      agenda_visits: [
        {
          data: { seen_at: '2026-10-09T08:00:00.000Z', baseline_at: null },
          error: null,
        },
        { data: null, error: null },
      ],
    });

    const visit = await recordAgendaVisit(client, USER_ID, AGENDA_NOW);

    expect(visit).toEqual({
      seen_at: AGENDA_NOW.toISOString(),
      baseline_at: '2026-10-09T08:00:00.000Z',
    });
    expect(queries.agenda_visits[1].calls[0]).toEqual([
      'upsert',
      { user_id: USER_ID, ...visit },
      { onConflict: 'user_id' },
    ]);
  });
});
